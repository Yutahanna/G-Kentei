import type { QuestionProgress } from "../../entities/progress";

/**
 * 章別ドリルで1回に出題する問題を選ぶ純粋関数。
 * 母集団の問題数が章ごとに違っても1回の量を揃え、弱い問題から優先して出すことで、
 * 章の全問を解く「模試」のような使い方ではなく、反復練習としてのドリルにする。
 */

export const DRILL_COUNT_OPTIONS = [10, 15, 20] as const;
export const DEFAULT_DRILL_COUNT = 10;

/**
 * 優先度（小さいほど先に出す）。
 * 0: 直近の回答が誤答  1: 過去に誤答があり、まだ連続正解が2回未満
 * 2: 未回答  3: それ以外（安定して正解している問題）
 */
export function drillPriority(progress: QuestionProgress | undefined): number {
  if (!progress || progress.attempts === 0) return 2;
  if (progress.correctStreak === 0) return 0;
  if (progress.incorrectCount > 0 && progress.correctStreak < 2) return 1;
  return 3;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/**
 * questionIds（教材順）から最大count問を選ぶ。countがnullなら全問。
 * 同じ優先度の中では、randomizeならランダム、そうでなければ教材順。
 * 安定して正解している問題は、連続正解が少なく最後の回答が古いものから選ぶ。
 * 選んだ問題の出題順は、randomizeならランダム、そうでなければ教材順。
 */
export function selectDrillQuestionIds(
  questionIds: string[],
  progressById: Map<string, QuestionProgress>,
  count: number | null,
  randomize: boolean,
  random: () => number = Math.random,
): string[] {
  if (count === null || count >= questionIds.length) {
    return randomize ? shuffle(questionIds, random) : [...questionIds];
  }

  const order = new Map(questionIds.map((id, i) => [id, i]));
  const candidates = randomize ? shuffle(questionIds, random) : [...questionIds];
  const ranked = candidates
    .map((id) => ({ id, progress: progressById.get(id) }))
    .sort((a, b) => {
      const pa = drillPriority(a.progress);
      const pb = drillPriority(b.progress);
      if (pa !== pb) return pa - pb;
      if (pa === 3) {
        const streak = a.progress!.correctStreak - b.progress!.correctStreak;
        if (streak !== 0) return streak;
        const lastA = a.progress!.lastAnsweredAt ?? "";
        const lastB = b.progress!.lastAnsweredAt ?? "";
        if (lastA !== lastB) return lastA < lastB ? -1 : 1;
      }
      return 0;
    });

  const selected = ranked.slice(0, count).map((r) => r.id);
  return randomize
    ? shuffle(selected, random)
    : selected.sort((a, b) => order.get(a)! - order.get(b)!);
}
