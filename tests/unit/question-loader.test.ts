import { describe, expect, it } from "vitest";
import {
  filterQuestions,
  getExamQuestionsByChapter,
  getQuestionById,
  getQuestionsByChapter,
  isPrincipleQuestion,
  isSupplementQuestion,
  isTermCheck,
  isCalculationQuestion,
} from "../../src/shared/lib/question-loader";
import {
  getChapterCounts,
  getDesignTargetCounts,
  sumCounts,
} from "../../scripts/lib/question-quality-checks";
import { isMultipleAnswer } from "../../src/shared/lib/answer";
import {
  allocateExamQuestionCounts,
  selectExamQuestionIds,
} from "../../src/shared/lib/examComposition";
import {
  CALCULATION_MAX_RATIO,
  EXAM_COMPOSITION_CONFIG,
} from "../../src/shared/config/examComposition";

const CHAPTER_IDS = Array.from({ length: 10 }, (_, i) => `ch${String(i + 1).padStart(2, "0")}`);
const expectedTotal = (chapterId: string) => sumCounts(getChapterCounts(chapterId));
const ALL_EXPECTED_TOTAL = CHAPTER_IDS.reduce((sum, id) => sum + expectedTotal(id), 0);
// すべて選ぶ問題（answerType: "multiple"）は章ごとの設計数とは別枠で追加している（2026-11-01、全20問）。
const MULTIPLE_TOTAL = 20;
// 用語確認の問題（category: "term_check"、補遺が出典）も章ごとの設計数とは別枠（2026-11-11、第2章に12問・第3章に26問・第4章に11問・第5章に34問・第6章に50問・第7章に10問・第8章に1問・第9章に12問・第10章に12問）。
const TERM_CHECK_TOTAL = 168;
// 計算問題（category: "calculation"、補遺が出典）も別枠（2026-11-11、第2章2問・第3章8問・第5章9問・第8章14問）。
const CALCULATION_TOTAL = 33;
// 原理理解の問題（category: "principle"）も別枠（2026-11-11、第3章6問・第4章1問・第5章10問・第6章3問）。
const PRINCIPLE_TOTAL = 20;
// 別の問題を解けば答えが決まる重複問題として削除した問題（docs/question-pool-audit-2026-11.md）。
const DELETED_QUESTION_IDS = [
  "ch01-basic-002",
  "ch03-basic-002",
  "ch04-basic-013",
  "ch04-standard-005",
  "ch05-basic-004",
  "ch05-basic-010",
  "ch05-standard-001",
  "ch05-standard-011",
  "ch05-standard-025",
  "ch06-basic-013",
  "ch06-standard-011",
  "ch10-basic-016",
  "ch10-standard-009",
  "ch10-standard-011",
];
const single = (chapterId: string) =>
  getQuestionsByChapter(chapterId).filter(
    (q) => !isMultipleAnswer(q) && (q.category ?? "chapter") === "chapter",
  );

describe("question-loader（全10章）", () => {
  it.each(CHAPTER_IDS)("%sの1つを選ぶ問題を設計値の問題数だけ読み込む", (chapterId) => {
    expect(single(chapterId)).toHaveLength(expectedTotal(chapterId));
  });

  it.each(CHAPTER_IDS)(
    "%sの1つを選ぶ問題は難易度ごとに章の構成（CHAPTER_COUNTS）どおりの数がある",
    (chapterId) => {
      const count = (difficulty: "basic" | "standard" | "advanced") =>
        filterQuestions({ chapterId, difficulties: [difficulty], category: "chapter" }).filter(
          (q) => !isMultipleAnswer(q),
        ).length;
      const expected = getChapterCounts(chapterId);
      expect(count("basic")).toBe(expected.basic);
      expect(count("standard")).toBe(expected.standard);
      expect(count("advanced")).toBe(expected.advanced);
    },
  );

  it.each(CHAPTER_IDS)(
    "%sの難易度の比率は設計目標（基礎:標準:応用=40%:40%:20%）から5ポイント以内、総数は設計目標の90〜110%である",
    (chapterId) => {
      const actual = getChapterCounts(chapterId);
      const target = getDesignTargetCounts(chapterId);
      const total = sumCounts(actual);
      expect(total).toBeGreaterThanOrEqual(sumCounts(target) * 0.9);
      expect(total).toBeLessThanOrEqual(sumCounts(target) * 1.1);
      for (const d of ["basic", "standard", "advanced"] as const) {
        expect(Math.abs(actual[d] / total - target[d] / sumCounts(target))).toBeLessThanOrEqual(
          0.05,
        );
      }
    },
  );

  it.each([20, 50, 90, 145])(
    "模擬試験%i問を、実際の問題プールから章の配分の上限・下限どおりに重複なく抽出できる",
    (totalCount) => {
      const idsByChapter = Object.fromEntries(
        CHAPTER_IDS.map((id) => [id, getExamQuestionsByChapter(id).map((q) => q.id)]),
      );
      const available = Object.fromEntries(
        Object.entries(idsByChapter).map(([id, ids]) => [id, ids.length]),
      );
      const counts = allocateExamQuestionCounts(totalCount, EXAM_COMPOSITION_CONFIG, available);
      expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(totalCount);
      for (const c of EXAM_COMPOSITION_CONFIG.perChapter) {
        const n = counts[c.chapterId] ?? 0;
        // 保有数が配分の上限を下回ると、上限どおりに出題できない。
        expect(available[c.chapterId]!).toBeGreaterThanOrEqual(Math.ceil(totalCount * c.maxRatio));
        // 整数への丸めで1問ずれることがある。
        expect(n).toBeGreaterThanOrEqual(Math.floor(totalCount * c.minRatio) - 1);
        expect(n).toBeLessThanOrEqual(Math.ceil(totalCount * c.maxRatio) + 1);
      }
      const calculationIds = new Set(
        CHAPTER_IDS.flatMap((id) => getExamQuestionsByChapter(id))
          .filter(isCalculationQuestion)
          .map((q) => q.id),
      );
      const maxCalculation = Math.round(totalCount * CALCULATION_MAX_RATIO);
      const ids = selectExamQuestionIds(
        totalCount,
        EXAM_COMPOSITION_CONFIG,
        idsByChapter,
        Math.random,
        new Set(),
        { ids: calculationIds, max: maxCalculation },
      );
      expect(ids).toHaveLength(totalCount);
      expect(new Set(ids).size).toBe(totalCount);
      for (const id of ids) {
        // 原理理解の問題は模擬試験に出さない。
        expect(getQuestionById(id)?.category ?? "chapter").not.toBe("principle");
      }
      expect(ids.filter((id) => calculationIds.has(id)).length).toBeLessThanOrEqual(maxCalculation);
    },
  );

  it("章末確認ポイント補強の問題は章の問題として模擬試験の出題候補に入る", () => {
    const added = [
      "ch01-basic-011",
      "ch02-basic-011",
      "ch07-standard-012",
      "ch07-standard-013",
      "ch08-basic-011",
    ];
    const examIds = new Set(
      CHAPTER_IDS.flatMap((id) => getExamQuestionsByChapter(id)).map((q) => q.id),
    );
    for (const id of added) {
      const q = getQuestionById(id);
      expect(q?.tags.crossChapterTags).toContain("章末確認ポイント補強");
      expect(examIds.has(id)).toBe(true);
    }
  });

  it("重複整理で削除した問題（2026-11-11）は読み込まれない", () => {
    for (const id of DELETED_QUESTION_IDS) {
      expect(getQuestionById(id)).toBeUndefined();
    }
  });

  it("全て選ぶ問題は全体で20問あり、4択で正解が2〜3個の肯定形である", () => {
    const multiple = CHAPTER_IDS.flatMap((id) => getQuestionsByChapter(id)).filter(
      isMultipleAnswer,
    );
    expect(multiple).toHaveLength(MULTIPLE_TOTAL);
    for (const q of multiple) {
      expect(q.choices).toHaveLength(4);
      expect(q.choiceExplanations).toHaveLength(4);
      expect(q.questionForm ?? "affirmative").toBe("affirmative");
      expect(q.correctAnswers!.length).toBeGreaterThanOrEqual(2);
      expect(q.correctAnswers!.length).toBeLessThanOrEqual(3);
    }
  });

  it("1つを選ぶ問題は4択で、正答インデックスが範囲内である", () => {
    for (const chapterId of CHAPTER_IDS) {
      for (const q of single(chapterId)) {
        expect(q.choices).toHaveLength(4);
        expect(q.choiceExplanations).toHaveLength(4);
        expect(q.correctAnswer).toBeGreaterThanOrEqual(0);
        expect(q.correctAnswer).toBeLessThanOrEqual(3);
      }
    }
  });

  it("全問題IDが一意である（章をまたいで重複がない）", () => {
    const ids = CHAPTER_IDS.flatMap((chapterId) =>
      getQuestionsByChapter(chapterId).map((q) => q.id),
    );
    expect(ids).toHaveLength(
      ALL_EXPECTED_TOTAL + MULTIPLE_TOTAL + TERM_CHECK_TOTAL + CALCULATION_TOTAL + PRINCIPLE_TOTAL,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("用語確認の問題は補遺を出典とし、模擬試験の出題候補に入る", () => {
    const terms = CHAPTER_IDS.flatMap((id) => getQuestionsByChapter(id)).filter(isTermCheck);
    expect(terms).toHaveLength(TERM_CHECK_TOTAL);
    for (const q of terms) {
      expect(q.sourceFile.startsWith("materials/supplements/")).toBe(true);
    }
    const examIds = new Set(
      CHAPTER_IDS.flatMap((id) => getExamQuestionsByChapter(id)).map((q) => q.id),
    );
    expect(terms.every((q) => examIds.has(q.id))).toBe(true);
    expect(filterQuestions({ chapterId: "ch02", category: "term_check" })).toHaveLength(12);
    expect(filterQuestions({ chapterId: "ch03", category: "term_check" })).toHaveLength(26);
    expect(filterQuestions({ chapterId: "ch04", category: "term_check" })).toHaveLength(11);
    expect(filterQuestions({ chapterId: "ch05", category: "term_check" })).toHaveLength(34);
    expect(filterQuestions({ chapterId: "ch06", category: "term_check" })).toHaveLength(50);
    expect(filterQuestions({ chapterId: "ch07", category: "term_check" })).toHaveLength(10);
    expect(filterQuestions({ chapterId: "ch08", category: "term_check" })).toHaveLength(1);
    expect(filterQuestions({ chapterId: "ch09", category: "term_check" })).toHaveLength(12);
    expect(filterQuestions({ chapterId: "ch10", category: "term_check" })).toHaveLength(12);
  });

  it("計算問題は補遺を出典とし、模擬試験の出題候補に入る", () => {
    const calc = CHAPTER_IDS.flatMap((id) => getQuestionsByChapter(id)).filter(
      (q) => q.category === "calculation",
    );
    expect(calc).toHaveLength(CALCULATION_TOTAL);
    const examIds = new Set(
      CHAPTER_IDS.flatMap((id) => getExamQuestionsByChapter(id)).map((q) => q.id),
    );
    for (const q of calc) {
      expect(q.sourceFile.startsWith("materials/supplements/")).toBe(true);
      expect(examIds.has(q.id)).toBe(true);
    }
  });

  it("原理理解の問題は補遺の問題とは区別され、模擬試験の出題候補には入らない", () => {
    const principle = CHAPTER_IDS.flatMap((id) => getQuestionsByChapter(id)).filter(
      isPrincipleQuestion,
    );
    expect(principle).toHaveLength(PRINCIPLE_TOTAL);
    const examIds = new Set(
      CHAPTER_IDS.flatMap((id) => getExamQuestionsByChapter(id)).map((q) => q.id),
    );
    for (const q of principle) {
      expect(isSupplementQuestion(q)).toBe(false);
      expect(examIds.has(q.id)).toBe(false);
      expect(q.choices).toHaveLength(4);
      expect(q.choiceExplanations).toHaveLength(4);
    }
    // 正解の位置はA〜Dに5問ずつ（出題時は選択肢の順番を入れ替える）。
    const positions = [0, 1, 2, 3].map(
      (i) => principle.filter((q) => q.correctAnswer === i).length,
    );
    expect(positions).toEqual([5, 5, 5, 5]);
    expect(filterQuestions({ chapterId: "ch03", category: "principle" })).toHaveLength(6);
    expect(filterQuestions({ chapterId: "ch04", category: "principle" })).toHaveLength(1);
    expect(filterQuestions({ chapterId: "ch05", category: "principle" })).toHaveLength(10);
    expect(filterQuestions({ chapterId: "ch06", category: "principle" })).toHaveLength(3);
    expect(filterQuestions({ chapterId: "ch07", category: "principle" })).toHaveLength(0);
  });

  it("getQuestionByIdで各章の問題を取得できる", () => {
    expect(getQuestionById("ch01-basic-001")?.chapterId).toBe("ch01");
    expect(getQuestionById("ch10-advanced-005")?.chapterId).toBe("ch10");
  });
});
