import { describe, expect, it } from "vitest";
import {
  filterQuestions,
  getQuestionById,
  getQuestionsByChapter,
} from "../../src/shared/lib/question-loader";
import {
  EXPECTED_TOTAL_BY_CHAPTER,
  EXPECTED_TOTAL_QUESTIONS,
} from "../../scripts/lib/question-quality-checks";

const CHAPTER_IDS = Array.from({ length: 10 }, (_, i) => `ch${String(i + 1).padStart(2, "0")}`);
const expectedTotal = (chapterId: string) =>
  EXPECTED_TOTAL_BY_CHAPTER[chapterId] ?? EXPECTED_TOTAL_QUESTIONS;
const ALL_EXPECTED_TOTAL = CHAPTER_IDS.reduce((sum, id) => sum + expectedTotal(id), 0);

describe("question-loader（全10章）", () => {
  it.each(CHAPTER_IDS)("%sの問題を設計値の問題数だけ読み込む", (chapterId) => {
    const questions = getQuestionsByChapter(chapterId);
    expect(questions).toHaveLength(expectedTotal(chapterId));
  });

  it.each(CHAPTER_IDS)("%sは難易度ごとに基礎:標準:応用=2:2:1である", (chapterId) => {
    const unit = expectedTotal(chapterId) / 5;
    expect(filterQuestions({ chapterId, difficulties: ["basic"] })).toHaveLength(unit * 2);
    expect(filterQuestions({ chapterId, difficulties: ["standard"] })).toHaveLength(unit * 2);
    expect(filterQuestions({ chapterId, difficulties: ["advanced"] })).toHaveLength(unit);
  });

  it("全問題が4択で、正答インデックスが範囲内である", () => {
    for (const chapterId of CHAPTER_IDS) {
      for (const q of getQuestionsByChapter(chapterId)) {
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
    expect(ids).toHaveLength(ALL_EXPECTED_TOTAL);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("getQuestionByIdで各章の問題を取得できる", () => {
    expect(getQuestionById("ch01-basic-001")?.chapterId).toBe("ch01");
    expect(getQuestionById("ch10-advanced-005")?.chapterId).toBe("ch10");
  });
});
