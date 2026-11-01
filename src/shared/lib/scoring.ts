import type { Question } from "../../entities/question";
import { getCorrectIndices, isCorrectSelection } from "./answer";

export interface AnswerResult {
  correct: boolean;
  selected: number[];
  correctIndices: number[];
}

export function scoreAnswer(question: Question, selected: readonly number[]): AnswerResult {
  return {
    correct: isCorrectSelection(question, selected),
    selected: [...selected],
    correctIndices: getCorrectIndices(question),
  };
}

export interface DrillSummary {
  total: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number; // 0-1
}

export function summarizeDrillResults(results: readonly { correct: boolean }[]): DrillSummary {
  const total = results.length;
  const correctCount = results.filter((r) => r.correct).length;
  return {
    total,
    correctCount,
    incorrectCount: total - correctCount,
    accuracy: total === 0 ? 0 : correctCount / total,
  };
}
