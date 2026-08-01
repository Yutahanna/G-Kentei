import type { Question } from "../../entities/question";

export interface AnswerResult {
  correct: boolean;
  selectedIndex: number;
  correctAnswer: number;
}

export function scoreAnswer(question: Question, selectedIndex: number): AnswerResult {
  return {
    correct: selectedIndex === question.correctAnswer,
    selectedIndex,
    correctAnswer: question.correctAnswer,
  };
}

export interface DrillSummary {
  total: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number; // 0-1
}

export function summarizeDrillResults(results: AnswerResult[]): DrillSummary {
  const total = results.length;
  const correctCount = results.filter((r) => r.correct).length;
  return {
    total,
    correctCount,
    incorrectCount: total - correctCount,
    accuracy: total === 0 ? 0 : correctCount / total,
  };
}
