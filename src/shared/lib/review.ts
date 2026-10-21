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

/**
 * 模試で誤答した問題は、その後この日数ぶん続けて正解すると復習対象から外れる。
 * 同じ日の正解は何回でも1回と数える（直前に見た答えの記憶だけで外れないようにする）。
 */
export const MOCK_REVIEW_GRADUATION_STREAK = 2;

/** 端末のローカル時刻での日付キー（YYYY-M-D）。 */
function localDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * 模試で誤答し、その後まだMOCK_REVIEW_GRADUATION_STREAK日ぶん続けて正解していない問題か。
 * 模試の未回答も誤答として扱う（ExamResultPageでincorrectとして記録する）。
 */
export function needsMockReview(progress: QuestionProgress): boolean {
  const lastMockWrong = progress.history.findLastIndex(
    (h) => h.source === "mock_exam" && h.result === "incorrect",
  );
  if (lastMockWrong === -1) return false;
  const correctDays = new Set<string>();
  for (let i = progress.history.length - 1; i > lastMockWrong; i--) {
    const entry = progress.history[i]!;
    if (entry.result !== "correct") break;
    correctDays.add(localDateKey(entry.answeredAt));
  }
  return correctDays.size < MOCK_REVIEW_GRADUATION_STREAK;
}

/** 復習の主対象：模試の誤答（未卒業）とブックマークした問題。 */
export function selectMockReviewQuestionIds(allProgress: QuestionProgress[]): string[] {
  return allProgress.filter((p) => p.bookmarked || needsMockReview(p)).map((p) => p.questionId);
}

export interface ReviewBuckets {
  mockReview: string[];
  dueForReview: string[];
  wrongAnswer: string[];
  bookmarked: string[];
}

export async function getReviewBuckets(now: Date = new Date()): Promise<ReviewBuckets> {
  const allProgress = await listAllQuestionProgress();
  return {
    mockReview: selectMockReviewQuestionIds(allProgress),
    dueForReview: selectDueForReviewQuestionIds(allProgress, now),
    wrongAnswer: selectWrongAnswerQuestionIds(allProgress),
    bookmarked: selectBookmarkedQuestionIds(allProgress),
  };
}
