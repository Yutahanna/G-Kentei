import { describe, expect, it } from "vitest";
import {
  computeAccuracyByChapter,
  computeAccuracyByDifficulty,
  computeAccuracyBySkillTag,
  computeAccuracyBySection,
  selectWeakSections,
} from "../../src/shared/lib/analytics";
import { createInitialProgress } from "../../src/entities/progress";
import type { QuestionProgress } from "../../src/entities/progress";
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

function answeredProgress(questionId: string, correct: boolean): QuestionProgress {
  return {
    ...createInitialProgress(questionId),
    attempts: 1,
    history: [
      {
        answeredAt: "2026-01-01T00:00:00.000Z",
        result: correct ? "correct" : "incorrect",
        selectedIndex: correct ? 0 : 1,
      },
    ],
  };
}

describe("analytics（弱点分析の集計ロジック）", () => {
  const questions: Question[] = [
    makeQuestion({
      id: "q1",
      chapterId: "ch01",
      sectionId: "ch01-s01",
      difficulty: "basic",
      tags: { contentTags: ["a"], skillTags: ["暗記"], crossChapterTags: [] },
    }),
    makeQuestion({
      id: "q2",
      chapterId: "ch01",
      sectionId: "ch01-s01",
      difficulty: "standard",
      tags: { contentTags: ["b"], skillTags: ["比較"], crossChapterTags: [] },
    }),
    makeQuestion({
      id: "q3",
      chapterId: "ch02",
      sectionId: "ch02-s01",
      difficulty: "basic",
      tags: { contentTags: ["a"], skillTags: ["暗記"], crossChapterTags: [] },
    }),
  ];
  const progressByQuestion: Record<string, QuestionProgress> = {
    q1: answeredProgress("q1", true),
    q2: answeredProgress("q2", false),
    // q3は未回答のまま
  };

  it("難易度別に回答済み・正答数を集計する", () => {
    const result = computeAccuracyByDifficulty(questions, progressByQuestion);
    expect(result.basic).toEqual({ total: 2, answered: 1, correct: 1, accuracy: 1 });
    expect(result.standard).toEqual({ total: 1, answered: 1, correct: 0, accuracy: 0 });
    expect(result.advanced).toEqual({ total: 0, answered: 0, correct: 0, accuracy: 0 });
  });

  it("スキルタグ別に正答率が低い順に並べる", () => {
    const result = computeAccuracyBySkillTag(questions, progressByQuestion);
    expect(result[0]?.skillTag).toBe("比較");
    expect(result[0]?.accuracy).toBe(0);
    const anki = result.find((r) => r.skillTag === "暗記");
    expect(anki?.total).toBe(2);
    expect(anki?.answered).toBe(1);
    expect(anki?.accuracy).toBe(1);
  });

  it("章別に集計する", () => {
    const result = computeAccuracyByChapter(questions, progressByQuestion, {
      ch01: "第1章",
      ch02: "第2章",
    });
    const ch01 = result.find((r) => r.chapterId === "ch01");
    const ch02 = result.find((r) => r.chapterId === "ch02");
    expect(ch01).toMatchObject({ total: 2, answered: 2, correct: 1 });
    expect(ch02).toMatchObject({ total: 1, answered: 0, correct: 0 });
  });

  it("節別に集計し、弱点候補を閾値で抽出する", () => {
    const sectionStats = computeAccuracyBySection(questions, progressByQuestion);
    const weak = selectWeakSections(sectionStats, 2, 0.6);
    expect(weak).toHaveLength(1);
    expect(weak[0]?.sectionId).toBe("ch01-s01");
    expect(weak[0]?.accuracy).toBe(0.5);
  });
});
