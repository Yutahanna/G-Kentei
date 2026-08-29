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
 * 応用問題は全問、章横断タグ（crossChapterTags）を持つ問題は全問を対象とし、
 * 基礎2問・標準3問の代表サンプル、自動検査で警告が出た全問題も加える（重複は除去）。
 * 代表サンプルは配列順（節の並び順）で先頭から選び、特定の節に偏らないようにする。
 */
export function selectFocusQuestionIds(input: FocusSelectionInput): Set<string> {
  const { questions, similarPairs, tagOverlaps, nearConceptResults } = input;
  const focusIds = new Set<string>();

  const sampleCounts: Record<Question["difficulty"], number> = {
    basic: 2,
    standard: 3,
    advanced: Number.POSITIVE_INFINITY, // 応用問題は全問を重点確認対象とする
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

/** 正答が特定の選択肢番号に偏っていないかを確認するための分布。 */
export interface AnswerPositionDistribution {
  countByIndex: [number, number, number, number];
  rateByIndex: [number, number, number, number];
  total: number;
}

export function computeAnswerPositionDistribution(
  questions: Question[],
): AnswerPositionDistribution {
  const countByIndex: [number, number, number, number] = [0, 0, 0, 0];
  for (const q of questions) {
    if (q.correctAnswer === 0) countByIndex[0]++;
    else if (q.correctAnswer === 1) countByIndex[1]++;
    else if (q.correctAnswer === 2) countByIndex[2]++;
    else if (q.correctAnswer === 3) countByIndex[3]++;
  }
  const total = questions.length;
  const rateByIndex = countByIndex.map((c) => (total === 0 ? 0 : c / total)) as [
    number,
    number,
    number,
    number,
  ];
  return { countByIndex, rateByIndex, total };
}

/**
 * 正答位置の偏りを警告する。25問中の目安として、いずれかの選択肢番号に
 * 40%（10問相当）を超えて集中している場合、または1種類の番号しか使われていない場合を警告とする。
 */
export function findAnswerPositionSkewWarning(questions: Question[]): string | null {
  if (questions.length === 0) return null;
  const { countByIndex, total } = computeAnswerPositionDistribution(questions);
  const usedPositions = countByIndex.filter((c) => c > 0).length;
  const maxRate = Math.max(...countByIndex) / total;
  if (usedPositions <= 1) {
    return `正答がすべて選択肢${countByIndex.findIndex((c) => c > 0) + 1}に固定されています（全${total}問）。`;
  }
  if (maxRate > 0.4) {
    const maxIndex = countByIndex.indexOf(Math.max(...countByIndex));
    return `正答が選択肢${maxIndex + 1}に偏っています（${countByIndex[maxIndex]}/${total}問、${(maxRate * 100).toFixed(0)}%）。`;
  }
  return null;
}

/** 章の問題数が設計値（既定: 25問、基礎10/標準10/応用5）と一致しているかを確認する。 */
export const EXPECTED_TOTAL_QUESTIONS = 25;
export const EXPECTED_COUNT_BY_DIFFICULTY: Record<Question["difficulty"], number> = {
  basic: 10,
  standard: 10,
  advanced: 5,
};

export interface DesignCountCheckResult {
  totalMatches: boolean;
  actualTotal: number;
  mismatchedDifficulties: {
    difficulty: Question["difficulty"];
    expected: number;
    actual: number;
  }[];
}

export function checkQuestionCountsAgainstDesign(questions: Question[]): DesignCountCheckResult {
  const actualTotal = questions.length;
  const mismatchedDifficulties: DesignCountCheckResult["mismatchedDifficulties"] = [];
  for (const difficulty of ["basic", "standard", "advanced"] as const) {
    const actual = questions.filter((q) => q.difficulty === difficulty).length;
    const expected = EXPECTED_COUNT_BY_DIFFICULTY[difficulty];
    if (actual !== expected) {
      mismatchedDifficulties.push({ difficulty, expected, actual });
    }
  }
  return {
    totalMatches: actualTotal === EXPECTED_TOTAL_QUESTIONS,
    actualTotal,
    mismatchedDifficulties,
  };
}

/**
 * 内容を十分理解していなくても消去しやすい、極端な断定表現のリスト。
 * 誤答選択肢にこれらが集中していないかを確認する（品質基準6節に対応）。
 */
export const EXTREME_PHRASES = [
  "完全に解決した",
  "すでに解決済み",
  "完全に解決済み",
  "同一の問題である",
  "同一の概念である",
  "無関係である",
  "すべて同じ技術である",
  "教材では触れられていない",
  "使い分けは存在しない",
  "一切触れられていない",
];

export interface ExtremePhraseResult {
  questionId: string;
  matchedChoiceIndexes: number[];
}

/** 誤答選択肢に極端な断定表現が含まれる問題を検出する。 */
export function findExtremePhraseUsages(questions: Question[]): ExtremePhraseResult[] {
  const results: ExtremePhraseResult[] = [];
  for (const q of questions) {
    const matchedChoiceIndexes: number[] = [];
    q.choices.forEach((choice, index) => {
      if (index === q.correctAnswer) return;
      if (EXTREME_PHRASES.some((phrase) => choice.includes(phrase))) {
        matchedChoiceIndexes.push(index);
      }
    });
    if (matchedChoiceIndexes.length > 0) {
      results.push({ questionId: q.id, matchedChoiceIndexes });
    }
  }
  return results;
}

export interface ChoiceLengthImbalance {
  questionId: string;
  correctLength: number;
  longestWrongLength: number;
  ratio: number;
}

/**
 * 正答選択肢が誤答選択肢に比べて極端に長くなっていないかを確認する。
 * 比率（正答文字数 ÷ 最長の誤答文字数）が1.6を超える問題を警告候補とする。
 */
const CHOICE_LENGTH_RATIO_THRESHOLD = 1.6;

export function findChoiceLengthImbalances(questions: Question[]): ChoiceLengthImbalance[] {
  const results: ChoiceLengthImbalance[] = [];
  for (const q of questions) {
    const correctLength = q.choices[q.correctAnswer]?.length ?? 0;
    const wrongLengths = q.choices.filter((_, i) => i !== q.correctAnswer).map((c) => c.length);
    const longestWrongLength = Math.max(...wrongLengths, 0);
    const ratio =
      longestWrongLength === 0 ? Number.POSITIVE_INFINITY : correctLength / longestWrongLength;
    if (ratio > CHOICE_LENGTH_RATIO_THRESHOLD) {
      results.push({ questionId: q.id, correctLength, longestWrongLength, ratio });
    }
  }
  return results;
}

/** 応用問題に事例適用型（skillTagsに「適用判断」を含む）問題が最低1問含まれるかを確認する。 */
export function hasCaseApplicationInAdvanced(questions: Question[]): boolean {
  const advanced = questions.filter((q) => q.difficulty === "advanced");
  if (advanced.length === 0) return true;
  return advanced.some((q) => q.tags.skillTags.includes("適用判断"));
}

/**
 * 問題文の末尾表現を大まかな型に分類し、同じ言い回しへの偏りを確認するための集計。
 * 固定パターンに一致しないものは「その他（バリエーション）」として扱う。
 */
const QUESTION_STEM_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "教材の内容に合致するもの", pattern: /教材の内容に合致するものはどれか。?$/ },
  {
    label: "教材の説明として正しいもの",
    pattern: /教材の(説明|内容)として(最も)?(適切|正しい)なものはどれか。?$/,
  },
  { label: "教材の趣旨に最も近いもの", pattern: /教材の趣旨に最も近いものはどれか。?$/ },
  { label: "教材が説明しているもの", pattern: /教材が説明しているものはどれか。?$/ },
  { label: "組み合わせ・比較を問うもの", pattern: /組み合わせとして.*どれか。?$/ },
  {
    label: "事例・状況への適用",
    pattern: /(段階に最も近いか|最も適切なものはどれか。?$|該当するか。?$)/,
  },
];

/**
 * 誤答選択肢に集中しやすい、断定的な副詞・限定表現のリスト。
 * 「すべての誤答がこの種の言い回しを含む」問題は、内容を読まずに
 * 断定表現を機械的に消去するだけで正答できてしまうため検出対象とする。
 * 数学用語としての「絶対値」や「非常に」に含まれる「常に」など、
 * 断定のニュアンスを持たない部分文字列の誤検出は正規表現の否定先読み／後読みで除外する。
 */
export const ABSOLUTE_QUALIFIER_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "すべて", pattern: /すべて|全て/ },
  { label: "常に", pattern: /(?<!非)常に/ },
  { label: "のみ", pattern: /のみ/ },
  { label: "必ず", pattern: /必ず/ },
  { label: "一切", pattern: /一切/ },
  { label: "絶対", pattern: /絶対(?!値)/ },
  { label: "唯一", pattern: /唯一/ },
  { label: "完全に", pattern: /完全に/ },
  { label: "決して", pattern: /決して/ },
];

export interface AbsoluteQualifierConcentration {
  questionId: string;
  wrongChoiceCount: number;
  wrongChoicesWithQualifier: number;
}

/**
 * 誤答選択肢の「全部」が断定的な副詞・限定表現を含む問題を検出する。
 * 誤答の一部だけが該当する場合は正当な紛らわしい誤答でありうるため対象外とし、
 * 「断定表現の有無だけで機械的に消去できてしまう」全件一致のケースのみ拾う。
 */
export function findAbsoluteQualifierConcentration(
  questions: Question[],
): AbsoluteQualifierConcentration[] {
  const results: AbsoluteQualifierConcentration[] = [];
  for (const q of questions) {
    const wrongIndexes = q.choices.map((_, i) => i).filter((i) => i !== q.correctAnswer);
    if (wrongIndexes.length === 0) continue;
    const wrongChoicesWithQualifier = wrongIndexes.filter((i) =>
      ABSOLUTE_QUALIFIER_PATTERNS.some(({ pattern }) => pattern.test(q.choices[i]!)),
    ).length;
    if (wrongChoicesWithQualifier === wrongIndexes.length) {
      results.push({
        questionId: q.id,
        wrongChoiceCount: wrongIndexes.length,
        wrongChoicesWithQualifier,
      });
    }
  }
  return results;
}

/** 章内の設問文が肯定形（合致するもの）か否定形（合致しないもの）かの件数分布。 */
export function computeQuestionFormDistribution(questions: Question[]): {
  affirmative: number;
  negative: number;
} {
  let affirmative = 0;
  let negative = 0;
  for (const q of questions) {
    if (q.questionForm === "negative") negative++;
    else affirmative++;
  }
  return { affirmative, negative };
}

export function computeQuestionStemFormatCounts(
  questions: Question[],
): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const q of questions) {
    const matched = QUESTION_STEM_PATTERNS.find((p) => p.pattern.test(q.question));
    const label = matched ? matched.label : "その他（バリエーション）";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count }));
}
