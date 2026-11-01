import { describe, expect, it } from "vitest";
import { scoreExam } from "../../src/shared/lib/examScoring";
import type { Question } from "../../src/entities/question";

function makeQuestion(overrides: Partial<Question> & Pick<Question, "id">): Question {
  return {
    chapterId: "ch01",
    sectionId: "ch01-s01",
    difficulty: "basic",
    question: "q",
    choices: ["a", "b", "c", "d"],
    correctAnswer: 0,
    explanation: "e",
    choiceExplanations: ["e1", "e2", "e3", "e4"],
    tags: { contentTags: ["t"], skillTags: ["暗記"], crossChapterTags: [] },
    sourceFile: "f",
    sourceHeading: "h",
    sourceReference: "r",
    contentVersion: "v1",
    createdAt: "2026-01-01T00:00:00.000Z",
    reviewStatus: "approved",
    ...overrides,
  };
}

describe("examScoring（模擬試験の採点）", () => {
  const questions: Question[] = [
    makeQuestion({ id: "q1", chapterId: "ch01", difficulty: "basic", correctAnswer: 0 }),
    makeQuestion({ id: "q2", chapterId: "ch01", difficulty: "standard", correctAnswer: 1 }),
    makeQuestion({ id: "q3", chapterId: "ch02", difficulty: "basic", correctAnswer: 2 }),
  ];

  it("正解・不正解・未回答を正しく集計する", () => {
    const score = scoreExam(questions, { q1: [0], q2: [0], q3: [] });
    expect(score.total).toBe(3);
    expect(score.correct).toBe(1);
    expect(score.incorrect).toBe(1);
    expect(score.unanswered).toBe(1);
    expect(score.accuracy).toBeCloseTo(1 / 3);
  });

  it("章別・難易度別に正しく内訳を出す", () => {
    const score = scoreExam(questions, { q1: [0], q2: [1], q3: [2] });
    const ch01 = score.byChapter.find((c) => c.chapterId === "ch01");
    const ch02 = score.byChapter.find((c) => c.chapterId === "ch02");
    expect(ch01).toMatchObject({ total: 2, correct: 2, unanswered: 0 });
    expect(ch02).toMatchObject({ total: 1, correct: 1, unanswered: 0 });
    expect(score.byDifficulty.basic).toMatchObject({ total: 2, correct: 2 });
    expect(score.byDifficulty.standard).toMatchObject({ total: 1, correct: 1 });
  });

  it("すべて選ぶ問題は、選んだ組が正解と完全に一致したときだけ正解にする", () => {
    const multi = makeQuestion({
      id: "m1",
      answerType: "multiple",
      question: "適切なものをすべて選べ。",
      choices: ["a", "b", "c", "d", "e"],
      choiceExplanations: ["a", "b", "c", "d", "e"],
      correctAnswer: undefined,
      correctAnswers: [1, 3],
    });
    expect(scoreExam([multi], { m1: [3, 1] }).correct).toBe(1);
    expect(scoreExam([multi], { m1: [1] }).incorrect).toBe(1);
    expect(scoreExam([multi], { m1: [1, 3, 4] }).incorrect).toBe(1);
    expect(scoreExam([multi], { m1: [] }).unanswered).toBe(1);
  });
});
