import { describe, expect, it } from "vitest";
import { filterQuestions, getQuestionsByChapter } from "../../src/shared/lib/question-loader";

describe("question-loader（第1章）", () => {
  it("第1章の問題を25問読み込む", () => {
    const questions = getQuestionsByChapter("ch01");
    expect(questions).toHaveLength(25);
  });

  it("難易度ごとに10/10/5問である", () => {
    expect(filterQuestions({ chapterId: "ch01", difficulties: ["basic"] })).toHaveLength(10);
    expect(filterQuestions({ chapterId: "ch01", difficulties: ["standard"] })).toHaveLength(10);
    expect(filterQuestions({ chapterId: "ch01", difficulties: ["advanced"] })).toHaveLength(5);
  });

  it("すべての問題が4択で、正答インデックスが範囲内である", () => {
    for (const q of getQuestionsByChapter("ch01")) {
      expect(q.choices).toHaveLength(4);
      expect(q.choiceExplanations).toHaveLength(4);
      expect(q.correctAnswer).toBeGreaterThanOrEqual(0);
      expect(q.correctAnswer).toBeLessThanOrEqual(3);
    }
  });

  it("すべての問題IDが一意である", () => {
    const ids = getQuestionsByChapter("ch01").map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
