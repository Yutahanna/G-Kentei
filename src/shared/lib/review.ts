import { isDueForReview } from "./srs";
import { listAllQuestionProgress } from "./db";
import type { QuestionProgress } from "../../entities/progress";

/**
 * SRS復習・誤答復習・ブックマークの3種類の復習対象問題IDを選び出す純粋関数群。
 * IndexedDBの実データではなく QuestionProgress[] を受け取るため、単体テストが容易。
 */

export function selectDueForReviewQuestionIds(
  allProgress: QuestionProgress[],
  now: Date = new Date(),
): string[] {
  return allProgress.filter((p) => isDueForReview(p, now)).map((p) => p.questionId);
}

export function selectWrongAnswerQuestionIds(allProgress: QuestionProgress[]): string[] {
  return allProgress
    .filter((p) => {
      const last = p.history[p.history.length - 1];
      return last !== undefined && last.result === "incorrect";
    })
    .map((p) => p.questionId);
}

export function selectBookmarkedQuestionIds(allProgress: QuestionProgress[]): string[] {
  return allProgress.filter((p) => p.bookmarked).map((p) => p.questionId);
}

export interface ReviewBuckets {
  dueForReview: string[];
  wrongAnswer: string[];
  bookmarked: string[];
}

export async function getReviewBuckets(now: Date = new Date()): Promise<ReviewBuckets> {
  const allProgress = await listAllQuestionProgress();
  return {
    dueForReview: selectDueForReviewQuestionIds(allProgress, now),
    wrongAnswer: selectWrongAnswerQuestionIds(allProgress),
    bookmarked: selectBookmarkedQuestionIds(allProgress),
  };
}
