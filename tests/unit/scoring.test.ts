import { describe, expect, it } from "vitest";
import { scoreAnswer, summarizeDrillResults } from "../../src/shared/lib/scoring";
import { getQuestionById } from "../../src/shared/lib/question-loader";

describe("scoring.scoreAnswer", () => {
  it("正解を選ぶと correct が true になる", () => {
    const question = getQuestionById("ch01-basic-001");
    expect(question).toBeDefined();
    const result = scoreAnswer(question!, question!.correctAnswer);
    expect(result.correct).toBe(true);
  });

  it("誤答を選ぶと correct が false になる", () => {
    const question = getQuestionById("ch01-basic-001");
    expect(question).toBeDefined();
    const wrongIndex = (question!.correctAnswer + 1) % question!.choices.length;
    const result = scoreAnswer(question!, wrongIndex);
    expect(result.correct).toBe(false);
  });
});

describe("scoring.summarizeDrillResults", () => {
  it("正答数・誤答数・正答率を正しく集計する", () => {
    const summary = summarizeDrillResults([
      { correct: true, selectedIndex: 0, correctAnswer: 0 },
      { correct: true, selectedIndex: 1, correctAnswer: 1 },
      { correct: false, selectedIndex: 2, correctAnswer: 0 },
      { correct: false, selectedIndex: 3, correctAnswer: 1 },
    ]);

    expect(summary.total).toBe(4);
    expect(summary.correctCount).toBe(2);
    expect(summary.incorrectCount).toBe(2);
    expect(summary.accuracy).toBe(0.5);
  });

  it("0問の場合は正答率0を返す", () => {
    const summary = summarizeDrillResults([]);
    expect(summary.total).toBe(0);
    expect(summary.accuracy).toBe(0);
  });
});
