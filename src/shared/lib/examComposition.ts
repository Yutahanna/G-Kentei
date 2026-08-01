import type { ExamCompositionConfig } from "../../entities/exam";

/**
 * 模擬試験の出題数配分アルゴリズム。docs/phase0-design.md 8.5節の
 * ExamCompositionConfig（教材ベース配分）から、章別の出題数を決定する純粋関数。
 *
 * 1. weightから素の比率を求める。
 * 2. minRatio/maxRatioでクリップし、合計が1になるよう再正規化する。
 * 3. 最大剰余法で整数の出題数に配分する。
 * 4. 章の保有問題数を超える場合は上限でキャップし、超過分を他の章へ再配分する。
 */
export function allocateExamQuestionCounts(
  totalCount: number,
  config: ExamCompositionConfig,
  availableByChapter: Record<string, number>,
): Record<string, number> {
  const chapters = config.perChapter.filter((c) => (availableByChapter[c.chapterId] ?? 0) > 0);
  if (chapters.length === 0 || totalCount <= 0) {
    return {};
  }

  const sumWeight = chapters.reduce((sum, c) => sum + c.weight, 0);
  const clampedRatios = new Map<string, number>();
  for (const c of chapters) {
    const raw = c.weight / sumWeight;
    clampedRatios.set(c.chapterId, Math.min(Math.max(raw, c.minRatio), c.maxRatio));
  }
  const sumClamped = Array.from(clampedRatios.values()).reduce((a, b) => a + b, 0);
  const normalizedRatios = new Map(
    Array.from(clampedRatios.entries()).map(([id, r]) => [id, r / sumClamped]),
  );

  const rawCounts = new Map(
    Array.from(normalizedRatios.entries()).map(([id, r]) => [id, r * totalCount]),
  );
  const counts = new Map(Array.from(rawCounts.entries()).map(([id, v]) => [id, Math.floor(v)]));

  let remainder = totalCount - Array.from(counts.values()).reduce((a, b) => a + b, 0);
  const byFractionDesc = Array.from(rawCounts.entries())
    .map(([id, v]) => [id, v - Math.floor(v)] as const)
    .sort((a, b) => b[1] - a[1]);
  for (let i = 0; remainder > 0 && i < byFractionDesc.length; i++, remainder--) {
    const [id] = byFractionDesc[i]!;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  // 章の保有数を超えた分をキャップし、余力のある章へ重み比例で再配分する。
  let overflow = 0;
  for (const [id, count] of counts) {
    const cap = availableByChapter[id] ?? 0;
    if (count > cap) {
      overflow += count - cap;
      counts.set(id, cap);
    }
  }
  let guard = 0;
  while (overflow > 0 && guard < 20) {
    guard++;
    const eligible = chapters.filter(
      (c) => (counts.get(c.chapterId) ?? 0) < (availableByChapter[c.chapterId] ?? 0),
    );
    if (eligible.length === 0) break;
    const sumEligibleWeight = eligible.reduce((s, c) => s + c.weight, 0);
    let distributed = 0;
    for (const c of eligible) {
      const cap = availableByChapter[c.chapterId] ?? 0;
      const room = cap - (counts.get(c.chapterId) ?? 0);
      const share = Math.max(1, Math.round((c.weight / sumEligibleWeight) * overflow));
      const add = Math.min(share, room, overflow - distributed);
      if (add <= 0) continue;
      counts.set(c.chapterId, (counts.get(c.chapterId) ?? 0) + add);
      distributed += add;
      if (distributed >= overflow) break;
    }
    overflow -= distributed;
    if (distributed === 0) break;
  }

  return Object.fromEntries(counts);
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export function selectExamQuestionIds(
  totalCount: number,
  config: ExamCompositionConfig,
  questionIdsByChapter: Record<string, string[]>,
  random: () => number = Math.random,
): string[] {
  const availableByChapter = Object.fromEntries(
    Object.entries(questionIdsByChapter).map(([id, ids]) => [id, ids.length]),
  );
  const counts = allocateExamQuestionCounts(totalCount, config, availableByChapter);

  const selected: string[] = [];
  for (const [chapterId, count] of Object.entries(counts)) {
    const pool = shuffle(questionIdsByChapter[chapterId] ?? [], random);
    selected.push(...pool.slice(0, count));
  }
  return shuffle(selected, random);
}
