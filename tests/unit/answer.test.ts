import { describe, expect, it } from "vitest";
import {
  formatChoices,
  getCorrectIndices,
  isCorrectChoice,
  isCorrectSelection,
  toggleSelection,
} from "../../src/shared/lib/answer";
import { questionSchema, type Question } from "../../src/schemas/question.schema";

const base = {
  id: "t-001",
  chapterId: "ch01",
  sectionId: "ch01-s01",
  difficulty: "basic",
  explanation: "解説",
  tags: { contentTags: ["t"], skillTags: ["暗記"], crossChapterTags: [] },
  sourceFile: "materials/chapters/04_第1章.md",
  sourceHeading: "h",
  sourceReference: "r",
  contentVersion: "v",
  createdAt: "2026-11-01",
  reviewStatus: "draft",
} as const;

const multiple = {
  ...base,
  answerType: "multiple",
  question: "適切なものを全て選べ。",
  choices: ["a", "b", "c", "d"],
  choiceExplanations: ["a", "b", "c", "d"],
  correctAnswers: [3, 0],
} as const;

describe("answer（1つを選ぶ問題とすべて選ぶ問題の共通処理）", () => {
  const single = {
    ...base,
    question: "どれか。",
    choices: ["a", "b", "c", "d"],
    choiceExplanations: ["a", "b", "c", "d"],
    correctAnswer: 2,
  } as unknown as Question;

  it("1つを選ぶ問題は従来どおりcorrectAnswerで採点する", () => {
    expect(getCorrectIndices(single)).toEqual([2]);
    expect(isCorrectSelection(single, [2])).toBe(true);
    expect(isCorrectSelection(single, [1])).toBe(false);
  });

  it("すべて選ぶ問題は順序に関係なく完全一致で正解、過不足があれば不正解", () => {
    const q = multiple as unknown as Question;
    expect(getCorrectIndices(q)).toEqual([0, 3]);
    expect(isCorrectChoice(q, 3)).toBe(true);
    expect(isCorrectSelection(q, [3, 0])).toBe(true);
    expect(isCorrectSelection(q, [0])).toBe(false);
    expect(isCorrectSelection(q, [0, 1, 3])).toBe(false);
    expect(formatChoices(q, [0, 3])).toBe("a ／ d");
  });

  it("選択の切り替えで追加・解除できる", () => {
    expect(toggleSelection([1], 3)).toEqual([1, 3]);
    expect(toggleSelection([1, 3], 1)).toEqual([3]);
  });
});

describe("questionSchema（すべて選ぶ問題の検証）", () => {
  it("正しい形式なら通る", () => {
    expect(questionSchema.safeParse(multiple).success).toBe(true);
  });

  it("選択肢が4〜6つでない・正解が1つや4つ・指示文が無い・否定形の場合は通らない", () => {
    expect(questionSchema.safeParse({ ...multiple, choices: ["a", "b", "c"] }).success).toBe(false);
    expect(questionSchema.safeParse({ ...multiple, correctAnswers: [1] }).success).toBe(false);
    expect(
      questionSchema.safeParse({
        ...multiple,
        choices: ["a", "b", "c", "d", "e"],
        choiceExplanations: ["a", "b", "c", "d", "e"],
        correctAnswers: [0, 1, 2, 3],
      }).success,
    ).toBe(false);
    expect(questionSchema.safeParse({ ...multiple, question: "どれか。" }).success).toBe(false);
    expect(questionSchema.safeParse({ ...multiple, questionForm: "negative" }).success).toBe(false);
  });

  it("「いくつでも選べ」の指示と6つの選択肢も受け付ける", () => {
    expect(
      questionSchema.safeParse({
        ...multiple,
        question: "適切なものをいくつでも選べ。",
        choices: ["a", "b", "c", "d", "e", "f"],
        choiceExplanations: ["a", "b", "c", "d", "e", "f"],
      }).success,
    ).toBe(true);
  });

  it("1つを選ぶ問題にcorrectAnswerが無ければ通らない", () => {
    expect(
      questionSchema.safeParse({
        ...base,
        question: "どれか。",
        choices: ["a", "b", "c", "d"],
        choiceExplanations: ["a", "b", "c", "d"],
      }).success,
    ).toBe(false);
  });
});
