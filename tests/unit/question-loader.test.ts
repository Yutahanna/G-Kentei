import { describe, expect, it } from "vitest";
import {
  filterQuestions,
  getQuestionById,
  getQuestionsByChapter,
} from "../../src/shared/lib/question-loader";

const CHAPTER_IDS = Array.from({ length: 10 }, (_, i) => `ch${String(i + 1).padStart(2, "0")}`);

describe("question-loader（全10章）", () => {
  it.each(CHAPTER_IDS)("%sの問題を25問読み込む", (chapterId) => {
    const questions = getQuestionsByChapter(chapterId);
    expect(questions).toHaveLength(25);
  });

  it.each(CHAPTER_IDS)("%sは難易度ごとに10/10/5問である", (chapterId) => {
    expect(filterQuestions({ chapterId, difficulties: ["basic"] })).toHaveLength(10);
    expect(filterQuestions({ chapterId, difficulties: ["standard"] })).toHaveLength(10);
    expect(filterQuestions({ chapterId, difficulties: ["advanced"] })).toHaveLength(5);
  });

  it("全250問が4択で、正答インデックスが範囲内である", () => {
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
    expect(ids).toHaveLength(250);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("getQuestionByIdで各章の問題を取得できる", () => {
    expect(getQuestionById("ch01-basic-001")?.chapterId).toBe("ch01");
    expect(getQuestionById("ch10-advanced-005")?.chapterId).toBe("ch10");
  });
});
