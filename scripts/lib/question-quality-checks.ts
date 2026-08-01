/**
 * 問題データの品質検査で使う純粋関数群。
 * scripts/validate-questions.ts と scripts/generate-question-review.ts の双方から
 * 参照する共通実装とし、章ごとに同じロジックを重複実装しないようにする。
 * docs/phase0-design.md 10節（品質基準・章ごとのレビューサイクル）に対応する。
 */
import type { Question } from "../../src/schemas/question.schema";

export interface SimilarPair {
  aId: string;
  bId: string;
  similarity: number;
}

export interface TagOverlapGroup {
  sectionId: string;
  contentTagKey: string;
  ids: string[];
}

export interface NearConceptResult {
  questionId: string;
  wrongChoiceCount: number;
  nearConceptHits: number;
  rate: number;
  flaggedChoiceIndexes: number[];
}

export interface DistributionRow {
  key: string;
  basic: number;
  standard: number;
  advanced: number;
  total: number;
}

const SIMILARITY_THRESHOLD = 0.8;
/**
 * 誤答選択肢のうち、近接概念を含むべき最低件数。
 * この検査は「概念語彙（contentTags）の文字列がそのまま選択肢に現れるか」という
 * 粗いヒューリスティックであり、良質な誤答でも言い回しが異なれば検出できないことが多い。
 * そのため閾値は低め（1件以上）とし、「1件も検出できない」問題だけを警告対象とする
 * （＝検出漏れを前提に、明らかな手がかりが皆無なものだけを拾う）。
 */
export const NEAR_CONCEPT_MIN_HITS = 1;

/** 正規化した文字列を2-gramトークン集合にする（表現レベルの類似度判定用）。 */
export function tokenize(text: string): Set<string> {
  const normalized = text.replace(/[「」『』（）()、。・\s]/g, "");
  const tokens = new Set<string>();
  for (let i = 0; i < normalized.length - 1; i++) {
    tokens.add(normalized.slice(i, i + 2));
  }
  return tokens;
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** 問題文＋選択肢の表現レベルの類似度が閾値超のペアを検出する（水増し・言い換えの重複確認用）。 */
export function findSimilarPairs(
  questions: Question[],
  threshold: number = SIMILARITY_THRESHOLD,
): SimilarPair[] {
  const pairs: SimilarPair[] = [];
  for (let i = 0; i < questions.length; i++) {
    const qi = questions[i]!;
    const ti = tokenize(qi.question + qi.choices.join(""));
    for (let j = i + 1; j < questions.length; j++) {
      const qj = questions[j]!;
      const tj = tokenize(qj.question + qj.choices.join(""));
      const similarity = jaccardSimilarity(ti, tj);
      if (similarity >= threshold) {
        pairs.push({ aId: qi.id, bId: qj.id, similarity });
      }
    }
  }
  return pairs;
}

function contentTagKey(q: Question): string {
  return [...q.tags.contentTags].sort().join(" / ");
}

/**
 * 同一節・contentTags完全一致の問題群を検出する。
 * 表現を変えただけの論点重複は、文面が大きく異なると類似度チェックをすり抜けることがあるため、
 * tagsという別の切り口で機械的に候補を挙げ、最終判断は人間のレビューに委ねる。
 * 同一概念を基礎・標準・応用の異なる切り口で扱うことは意図的な設計でありうるため、警告に留める。
 */
export function findContentTagOverlaps(questions: Question[]): TagOverlapGroup[] {
  const groups = new Map<string, Question[]>();
  for (const q of questions) {
    const key = `${q.sectionId}::${contentTagKey(q)}`;
    const arr = groups.get(key) ?? [];
    arr.push(q);
    groups.set(key, arr);
  }
  const result: TagOverlapGroup[] = [];
  for (const [key, qs] of groups) {
    if (qs.length > 1) {
      const [sectionId, tagKey] = key.split("::") as [string, string];
      result.push({ sectionId, contentTagKey: tagKey, ids: qs.map((q) => q.id) });
    }
  }
  return result;
}

/**
 * 章内の全問題のcontentTagsを集めた「概念語彙」を構築する。
 * 誤答選択肢がこの語彙に含まれる概念に言及しているかどうかを、
 * 「近接概念を用いたもっともらしい誤答」であるかの機械的な近似指標として使う。
 * 語のマッチのみに基づく粗い近似であり、誤検出・見逃しの両方がありうるため警告用途に限定する。
 */
export function buildConceptVocabulary(questions: Question[]): string[] {
  const vocab = new Set<string>();
  for (const q of questions) {
    for (const tag of q.tags.contentTags) {
      if (tag.length >= 2) vocab.add(tag);
    }
  }
  // 長い語から先に照合すると部分文字列の誤マッチ（短い語が長い語の一部として偶然一致する等）を減らせる。
  return [...vocab].sort((a, b) => b.length - a.length);
}

/** 誤答選択肢のうち、概念語彙に含まれる語を含むものの割合を計算する。 */
export function computeNearConceptRate(
  question: Question,
  vocabulary: string[],
): NearConceptResult {
  const flaggedChoiceIndexes: number[] = [];
  let nearConceptHits = 0;
  let wrongChoiceCount = 0;

  question.choices.forEach((choice, index) => {
    if (index === question.correctAnswer) return;
    wrongChoiceCount++;
    const matched = vocabulary.some((term) => choice.includes(term));
    if (matched) {
      nearConceptHits++;
    } else {
      flaggedChoiceIndexes.push(index);
    }
  });

  return {
    questionId: question.id,
    wrongChoiceCount,
    nearConceptHits,
    rate: wrongChoiceCount === 0 ? 1 : nearConceptHits / wrongChoiceCount,
    flaggedChoiceIndexes,
  };
}

/** 節別・難易度別の問題数分布を集計する。 */
export function computeSectionDistribution(questions: Question[]): DistributionRow[] {
  const sectionIds = Array.from(new Set(questions.map((q) => q.sectionId))).sort();
  return sectionIds.map((sectionId) => {
    const inSection = questions.filter((q) => q.sectionId === sectionId);
    return {
      key: sectionId,
      basic: inSection.filter((q) => q.difficulty === "basic").length,
      standard: inSection.filter((q) => q.difficulty === "standard").length,
      advanced: inSection.filter((q) => q.difficulty === "advanced").length,
      total: inSection.length,
    };
  });
}

export const SKILL_TAG_VALUES = ["暗記", "比較", "関係性", "適用判断"] as const;

/**
 * skillTags別の問題数分布を集計する。
 * 1問に複数のskillTagsを付与できるため、この集計の件数合計は問題総数を超える場合がある。
 */
export function computeSkillTagDistribution(questions: Question[]): DistributionRow[] {
  return SKILL_TAG_VALUES.map((skill) => {
    const withSkill = questions.filter((q) => q.tags.skillTags.includes(skill));
    return {
      key: skill,
      basic: withSkill.filter((q) => q.difficulty === "basic").length,
      standard: withSkill.filter((q) => q.difficulty === "standard").length,
      advanced: withSkill.filter((q) => q.difficulty === "advanced").length,
      total: withSkill.length,
    };
  });
}

export interface FocusSelectionInput {
  questions: Question[];
  similarPairs: SimilarPair[];
  tagOverlaps: TagOverlapGroup[];
  nearConceptResults: NearConceptResult[];
}

/**
 * 重点レビュー対象を自動抽出する。
 * 基礎2問・標準3問・応用3問の代表サンプルに加え、自動検査で警告が出た全問題、
 * 教材横断タグ（crossChapterTags）を持つ全問題を対象とする（重複は除去）。
 * 代表サンプルは配列順（節の並び順）で先頭から選び、特定の節に偏らないようにする。
 */
export function selectFocusQuestionIds(input: FocusSelectionInput): Set<string> {
  const { questions, similarPairs, tagOverlaps, nearConceptResults } = input;
  const focusIds = new Set<string>();

  const sampleCounts: Record<Question["difficulty"], number> = {
    basic: 2,
    standard: 3,
    advanced: 3,
  };
  for (const difficulty of ["basic", "standard", "advanced"] as const) {
    questions
      .filter((q) => q.difficulty === difficulty)
      .slice(0, sampleCounts[difficulty])
      .forEach((q) => focusIds.add(q.id));
  }

  for (const pair of similarPairs) {
    focusIds.add(pair.aId);
    focusIds.add(pair.bId);
  }
  for (const group of tagOverlaps) {
    group.ids.forEach((id) => focusIds.add(id));
  }
  for (const result of nearConceptResults) {
    if (result.nearConceptHits < NEAR_CONCEPT_MIN_HITS) {
      focusIds.add(result.questionId);
    }
  }
  for (const q of questions) {
    if (q.tags.crossChapterTags.length > 0) {
      focusIds.add(q.id);
    }
  }

  return focusIds;
}
