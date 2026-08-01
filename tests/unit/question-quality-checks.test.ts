import { describe, expect, it } from "vitest";
import type { Question } from "../../src/schemas/question.schema";
import {
  buildConceptVocabulary,
  checkQuestionCountsAgainstDesign,
  computeAnswerPositionDistribution,
  computeNearConceptRate,
  computeQuestionStemFormatCounts,
  computeSectionDistribution,
  computeSkillTagDistribution,
  findAnswerPositionSkewWarning,
  findChoiceLengthImbalances,
  findContentTagOverlaps,
  findExtremePhraseUsages,
  findSimilarPairs,
  hasCaseApplicationInAdvanced,
  jaccardSimilarity,
  selectFocusQuestionIds,
  tokenize,
} from "../../scripts/lib/question-quality-checks";

function makeQuestion(overrides: Partial<Question> & { id: string }): Question {
  return {
    chapterId: "ch99",
    sectionId: "ch99-s01",
    difficulty: "basic",
    question: `テスト問題 ${overrides.id}`,
    choices: ["選択肢A", "選択肢B", "選択肢C", "選択肢D"],
    correctAnswer: 0,
    explanation: "テスト用の解説。",
    choiceExplanations: ["正しい。", "誤り。", "誤り。", "誤り。"],
    tags: { contentTags: ["概念X"], skillTags: ["暗記"], crossChapterTags: [] },
    sourceFile: "materials/chapters/99_テスト.md",
    sourceHeading: "1. テスト節",
    sourceReference: "第99章 1節（テスト節）",
    contentVersion: "dummy-hash",
    createdAt: "2026-08-01",
    reviewStatus: "draft",
    ...overrides,
  };
}

describe("tokenize / jaccardSimilarity", () => {
  it("同一文字列の類似度は1になる", () => {
    const a = tokenize("人工知能とは何か");
    const b = tokenize("人工知能とは何か");
    expect(jaccardSimilarity(a, b)).toBe(1);
  });

  it("全く異なる文字列の類似度は低い", () => {
    const a = tokenize("人工知能の定義について");
    const b = tokenize("株式会社の決算報告書について");
    expect(jaccardSimilarity(a, b)).toBeLessThan(0.3);
  });
});

describe("findSimilarPairs", () => {
  it("ほぼ同一の問題文＋選択肢を持つ組を検出する", () => {
    const q1 = makeQuestion({
      id: "q1",
      question: "人工知能の定義は専門家の間でも一つに定まっていない。正しいか。",
    });
    const q2 = makeQuestion({
      id: "q2",
      question: "人工知能の定義は専門家の間でも一つに定まっていない。正しいか。",
    });
    const q3 = makeQuestion({ id: "q3", question: "全く別内容の問題文である。" });

    const pairs = findSimilarPairs([q1, q2, q3]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ aId: "q1", bId: "q2" });
  });
});

describe("findContentTagOverlaps", () => {
  it("同一節・contentTags完全一致の問題をグループ化する", () => {
    const q1 = makeQuestion({
      id: "q1",
      sectionId: "ch99-s01",
      tags: { contentTags: ["A", "B"], skillTags: ["暗記"], crossChapterTags: [] },
    });
    const q2 = makeQuestion({
      id: "q2",
      sectionId: "ch99-s01",
      tags: { contentTags: ["B", "A"], skillTags: ["比較"], crossChapterTags: [] },
    });
    const q3 = makeQuestion({
      id: "q3",
      sectionId: "ch99-s01",
      tags: { contentTags: ["C"], skillTags: ["暗記"], crossChapterTags: [] },
    });
    const q4 = makeQuestion({
      id: "q4",
      sectionId: "ch99-s02",
      tags: { contentTags: ["A", "B"], skillTags: ["暗記"], crossChapterTags: [] },
    });

    const groups = findContentTagOverlaps([q1, q2, q3, q4]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.ids.sort()).toEqual(["q1", "q2"]);
  });
});

describe("buildConceptVocabulary / computeNearConceptRate", () => {
  it("誤答選択肢が語彙に含まれる概念に言及していれば近接概念ありと判定する", () => {
    const questions = [
      makeQuestion({
        id: "q1",
        tags: { contentTags: ["AI効果"], skillTags: ["暗記"], crossChapterTags: [] },
      }),
      makeQuestion({
        id: "q2",
        tags: { contentTags: ["チューリングテスト"], skillTags: ["暗記"], crossChapterTags: [] },
      }),
    ];
    const vocabulary = buildConceptVocabulary(questions);
    expect(vocabulary).toContain("AI効果");
    expect(vocabulary).toContain("チューリングテスト");

    const target = makeQuestion({
      id: "target",
      correctAnswer: 0,
      choices: ["正解の選択肢", "AI効果に関する誤答", "無関係な誤答", "別の無関係な誤答"],
    });
    const result = computeNearConceptRate(target, vocabulary);
    expect(result.wrongChoiceCount).toBe(3);
    expect(result.nearConceptHits).toBe(1);
    expect(result.flaggedChoiceIndexes).toEqual([2, 3]);
  });

  it("誤答がいずれも語彙に一致しない場合はnearConceptHitsが0になる", () => {
    const vocabulary = ["AI効果", "チューリングテスト"];
    const target = makeQuestion({
      id: "target2",
      correctAnswer: 0,
      choices: ["正解", "無関係1", "無関係2", "無関係3"],
    });
    const result = computeNearConceptRate(target, vocabulary);
    expect(result.nearConceptHits).toBe(0);
    expect(result.rate).toBe(0);
  });
});

describe("computeSectionDistribution / computeSkillTagDistribution", () => {
  it("節別・難易度別の件数を正しく集計する", () => {
    const questions = [
      makeQuestion({ id: "q1", sectionId: "ch99-s01", difficulty: "basic" }),
      makeQuestion({ id: "q2", sectionId: "ch99-s01", difficulty: "standard" }),
      makeQuestion({ id: "q3", sectionId: "ch99-s02", difficulty: "advanced" }),
    ];
    const rows = computeSectionDistribution(questions);
    const s01 = rows.find((r) => r.key === "ch99-s01")!;
    expect(s01.basic).toBe(1);
    expect(s01.standard).toBe(1);
    expect(s01.total).toBe(2);
  });

  it("1問に複数skillTagsがある場合、両方のskillTagでカウントされる（合計は問題総数を超えうる）", () => {
    const questions = [
      makeQuestion({
        id: "q1",
        tags: { contentTags: ["X"], skillTags: ["関係性", "適用判断"], crossChapterTags: [] },
      }),
    ];
    const rows = computeSkillTagDistribution(questions);
    const relational = rows.find((r) => r.key === "関係性")!;
    const applied = rows.find((r) => r.key === "適用判断")!;
    expect(relational.total).toBe(1);
    expect(applied.total).toBe(1);
  });
});

describe("selectFocusQuestionIds", () => {
  it("代表サンプル・警告あり問題・crossChapterTags保持問題を過不足なく含む", () => {
    const basics = Array.from({ length: 5 }, (_, i) =>
      makeQuestion({ id: `basic-${i}`, difficulty: "basic" }),
    );
    const crossChapterQuestion = makeQuestion({
      id: "cross-1",
      difficulty: "basic",
      tags: { contentTags: ["X"], skillTags: ["暗記"], crossChapterTags: ["第2章:接続"] },
    });
    const questions = [...basics, crossChapterQuestion];

    const focusIds = selectFocusQuestionIds({
      questions,
      similarPairs: [{ aId: "basic-4", bId: "basic-3", similarity: 0.9 }],
      tagOverlaps: [],
      nearConceptResults: [],
    });

    // 代表サンプル(先頭2件) + 類似度警告の2件 + crossChapterTagsを持つ1件
    expect(focusIds.has("basic-0")).toBe(true);
    expect(focusIds.has("basic-1")).toBe(true);
    expect(focusIds.has("basic-3")).toBe(true);
    expect(focusIds.has("basic-4")).toBe(true);
    expect(focusIds.has("cross-1")).toBe(true);
    expect(focusIds.has("basic-2")).toBe(false);
  });

  it("応用問題は件数によらずすべて含む", () => {
    const advanced = Array.from({ length: 5 }, (_, i) =>
      makeQuestion({ id: `advanced-${i}`, difficulty: "advanced" }),
    );
    const focusIds = selectFocusQuestionIds({
      questions: advanced,
      similarPairs: [],
      tagOverlaps: [],
      nearConceptResults: [],
    });
    for (let i = 0; i < 5; i++) {
      expect(focusIds.has(`advanced-${i}`)).toBe(true);
    }
  });
});

describe("computeAnswerPositionDistribution / findAnswerPositionSkewWarning", () => {
  it("正答位置ごとの件数と比率を集計する", () => {
    const questions = [
      makeQuestion({ id: "q1", correctAnswer: 0 }),
      makeQuestion({ id: "q2", correctAnswer: 0 }),
      makeQuestion({ id: "q3", correctAnswer: 1 }),
      makeQuestion({ id: "q4", correctAnswer: 3 }),
    ];
    const dist = computeAnswerPositionDistribution(questions);
    expect(dist.countByIndex).toEqual([2, 1, 0, 1]);
    expect(dist.rateByIndex[0]).toBe(0.5);
  });

  it("正答がすべて同じ選択肢に固定されている場合に警告する", () => {
    const questions = Array.from({ length: 5 }, (_, i) =>
      makeQuestion({ id: `q${i}`, correctAnswer: 0 }),
    );
    expect(findAnswerPositionSkewWarning(questions)).toMatch(/選択肢1に固定/);
  });

  it("正答が特定の選択肢に4割を超えて偏っている場合に警告する", () => {
    const questions = [
      ...Array.from({ length: 5 }, (_, i) => makeQuestion({ id: `a${i}`, correctAnswer: 0 })),
      makeQuestion({ id: "b0", correctAnswer: 1 }),
      makeQuestion({ id: "b1", correctAnswer: 2 }),
      makeQuestion({ id: "b2", correctAnswer: 3 }),
    ];
    expect(findAnswerPositionSkewWarning(questions)).toMatch(/偏っています/);
  });

  it("バランスの取れた分布では警告しない", () => {
    const questions = [
      makeQuestion({ id: "q1", correctAnswer: 0 }),
      makeQuestion({ id: "q2", correctAnswer: 1 }),
      makeQuestion({ id: "q3", correctAnswer: 2 }),
      makeQuestion({ id: "q4", correctAnswer: 3 }),
    ];
    expect(findAnswerPositionSkewWarning(questions)).toBeNull();
  });
});

describe("checkQuestionCountsAgainstDesign", () => {
  it("設計値(25問、基礎10/標準10/応用5)と一致する場合はtotalMatchesがtrueになる", () => {
    const questions = [
      ...Array.from({ length: 10 }, (_, i) => makeQuestion({ id: `b${i}`, difficulty: "basic" })),
      ...Array.from({ length: 10 }, (_, i) =>
        makeQuestion({ id: `s${i}`, difficulty: "standard" }),
      ),
      ...Array.from({ length: 5 }, (_, i) => makeQuestion({ id: `a${i}`, difficulty: "advanced" })),
    ];
    const result = checkQuestionCountsAgainstDesign(questions);
    expect(result.totalMatches).toBe(true);
    expect(result.mismatchedDifficulties).toHaveLength(0);
  });

  it("難易度別の件数が設計値と異なる場合に検出する", () => {
    const questions = [makeQuestion({ id: "b0", difficulty: "basic" })];
    const result = checkQuestionCountsAgainstDesign(questions);
    expect(result.totalMatches).toBe(false);
    expect(result.mismatchedDifficulties.map((m) => m.difficulty)).toContain("basic");
  });
});

describe("findExtremePhraseUsages", () => {
  it("誤答選択肢に極端な断定表現が含まれる場合に検出する", () => {
    const q = makeQuestion({
      id: "q1",
      correctAnswer: 0,
      choices: ["正解", "教材では触れられていない話題である。", "誤答2", "誤答3"],
    });
    const results = findExtremePhraseUsages([q]);
    expect(results).toHaveLength(1);
    expect(results[0]!.matchedChoiceIndexes).toEqual([1]);
  });

  it("正答自体に極端な表現が含まれても誤答チェックの対象にはしない", () => {
    const q = makeQuestion({
      id: "q1",
      correctAnswer: 0,
      choices: ["すでに解決済みである。", "誤答1", "誤答2", "誤答3"],
    });
    expect(findExtremePhraseUsages([q])).toHaveLength(0);
  });
});

describe("findChoiceLengthImbalances", () => {
  it("正答が最長の誤答より1.6倍を超えて長い場合に検出する", () => {
    const q = makeQuestion({
      id: "q1",
      correctAnswer: 0,
      choices: [
        "これは非常に長く具体的で詳細な説明を伴う正答選択肢のテキストです。".repeat(2),
        "短い誤答。",
        "短い誤答。",
        "短い誤答。",
      ],
    });
    const results = findChoiceLengthImbalances([q]);
    expect(results).toHaveLength(1);
    expect(results[0]!.questionId).toBe("q1");
  });

  it("選択肢間の文量が同程度であれば検出しない", () => {
    const q = makeQuestion({
      id: "q1",
      correctAnswer: 0,
      choices: [
        "ほぼ同じ長さの選択肢A",
        "ほぼ同じ長さの選択肢B",
        "ほぼ同じ長さの選択肢C",
        "ほぼ同じ長さの選択肢D",
      ],
    });
    expect(findChoiceLengthImbalances([q])).toHaveLength(0);
  });
});

describe("hasCaseApplicationInAdvanced", () => {
  it("応用問題にskillTagsが適用判断の問題が1問もない場合はfalseを返す", () => {
    const questions = [
      makeQuestion({
        id: "a1",
        difficulty: "advanced",
        tags: { contentTags: ["X"], skillTags: ["関係性"], crossChapterTags: [] },
      }),
    ];
    expect(hasCaseApplicationInAdvanced(questions)).toBe(false);
  });

  it("応用問題に適用判断が1問でもあればtrueを返す", () => {
    const questions = [
      makeQuestion({
        id: "a1",
        difficulty: "advanced",
        tags: { contentTags: ["X"], skillTags: ["関係性"], crossChapterTags: [] },
      }),
      makeQuestion({
        id: "a2",
        difficulty: "advanced",
        tags: { contentTags: ["X"], skillTags: ["適用判断"], crossChapterTags: [] },
      }),
    ];
    expect(hasCaseApplicationInAdvanced(questions)).toBe(true);
  });

  it("応用問題が存在しない場合はtrueを返す（対象外のため警告しない）", () => {
    const questions = [makeQuestion({ id: "b1", difficulty: "basic" })];
    expect(hasCaseApplicationInAdvanced(questions)).toBe(true);
  });
});

describe("computeQuestionStemFormatCounts", () => {
  it("問題文の末尾パターンごとに件数を分類する", () => {
    const questions = [
      makeQuestion({ id: "q1", question: "これは教材の内容に合致するものはどれか。" }),
      makeQuestion({ id: "q2", question: "これは教材の内容に合致するものはどれか。" }),
      makeQuestion({ id: "q3", question: "この事例が示す技術的段階に該当するか。" }),
    ];
    const counts = computeQuestionStemFormatCounts(questions);
    const total = counts.reduce((sum, c) => sum + c.count, 0);
    expect(total).toBe(3);
  });
});
