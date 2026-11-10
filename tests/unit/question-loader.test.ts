import { describe, expect, it } from "vitest";
import {
  filterQuestions,
  getExamQuestionsByChapter,
  getQuestionById,
  getQuestionsByChapter,
  isSupplementQuestion,
  isTermCheck,
} from "../../src/shared/lib/question-loader";
import {
  EXPECTED_TOTAL_BY_CHAPTER,
  EXPECTED_TOTAL_QUESTIONS,
} from "../../scripts/lib/question-quality-checks";
import { isMultipleAnswer } from "../../src/shared/lib/answer";

const CHAPTER_IDS = Array.from({ length: 10 }, (_, i) => `ch${String(i + 1).padStart(2, "0")}`);
const expectedTotal = (chapterId: string) =>
  EXPECTED_TOTAL_BY_CHAPTER[chapterId] ?? EXPECTED_TOTAL_QUESTIONS;
const ALL_EXPECTED_TOTAL = CHAPTER_IDS.reduce((sum, id) => sum + expectedTotal(id), 0);
// すべて選ぶ問題（answerType: "multiple"）は章ごとの設計数とは別枠で追加している（2026-11-01、全20問）。
const MULTIPLE_TOTAL = 20;
// 用語確認の問題（category: "term_check"、補遺が出典）も章ごとの設計数とは別枠（2026-11-11、第2章に12問・第3章に13問・第4章に4問・第5章に25問・第6章に46問・第9章に12問・第10章に12問）。
const TERM_CHECK_TOTAL = 124;
// 計算問題（category: "calculation"、補遺が出典）も別枠（2026-11-11、第2章2問・第3章5問・第5章8問・第8章13問）。
const CALCULATION_TOTAL = 28;
const single = (chapterId: string) =>
  getQuestionsByChapter(chapterId).filter((q) => !isMultipleAnswer(q) && !isSupplementQuestion(q));

describe("question-loader（全10章）", () => {
  it.each(CHAPTER_IDS)("%sの1つを選ぶ問題を設計値の問題数だけ読み込む", (chapterId) => {
    expect(single(chapterId)).toHaveLength(expectedTotal(chapterId));
  });

  it.each(CHAPTER_IDS)("%sの1つを選ぶ問題は難易度ごとに基礎:標準:応用=2:2:1である", (chapterId) => {
    const unit = expectedTotal(chapterId) / 5;
    const count = (difficulty: "basic" | "standard" | "advanced") =>
      filterQuestions({ chapterId, difficulties: [difficulty], category: "chapter" }).filter(
        (q) => !isMultipleAnswer(q),
      ).length;
    expect(count("basic")).toBe(unit * 2);
    expect(count("standard")).toBe(unit * 2);
    expect(count("advanced")).toBe(unit);
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
      ALL_EXPECTED_TOTAL + MULTIPLE_TOTAL + TERM_CHECK_TOTAL + CALCULATION_TOTAL,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("用語確認の問題は補遺を出典とし、模擬試験の出題候補には入らない", () => {
    const terms = CHAPTER_IDS.flatMap((id) => getQuestionsByChapter(id)).filter(isTermCheck);
    expect(terms).toHaveLength(TERM_CHECK_TOTAL);
    for (const q of terms) {
      expect(q.sourceFile.startsWith("materials/supplements/")).toBe(true);
    }
    const examIds = new Set(
      CHAPTER_IDS.flatMap((id) => getExamQuestionsByChapter(id)).map((q) => q.id),
    );
    expect(terms.some((q) => examIds.has(q.id))).toBe(false);
    expect(filterQuestions({ chapterId: "ch02", category: "term_check" })).toHaveLength(12);
    expect(filterQuestions({ chapterId: "ch03", category: "term_check" })).toHaveLength(13);
    expect(filterQuestions({ chapterId: "ch04", category: "term_check" })).toHaveLength(4);
    expect(filterQuestions({ chapterId: "ch05", category: "term_check" })).toHaveLength(25);
    expect(filterQuestions({ chapterId: "ch06", category: "term_check" })).toHaveLength(46);
    expect(filterQuestions({ chapterId: "ch09", category: "term_check" })).toHaveLength(12);
    expect(filterQuestions({ chapterId: "ch10", category: "term_check" })).toHaveLength(12);
  });

  it("計算問題は補遺を出典とし、模擬試験の出題候補には入らない", () => {
    const calc = CHAPTER_IDS.flatMap((id) => getQuestionsByChapter(id)).filter(
      (q) => q.category === "calculation",
    );
    expect(calc).toHaveLength(CALCULATION_TOTAL);
    const examIds = new Set(
      CHAPTER_IDS.flatMap((id) => getExamQuestionsByChapter(id)).map((q) => q.id),
    );
    for (const q of calc) {
      expect(q.sourceFile.startsWith("materials/supplements/")).toBe(true);
      expect(examIds.has(q.id)).toBe(false);
    }
  });

  it("getQuestionByIdで各章の問題を取得できる", () => {
    expect(getQuestionById("ch01-basic-001")?.chapterId).toBe("ch01");
    expect(getQuestionById("ch10-advanced-005")?.chapterId).toBe("ch10");
  });
});
