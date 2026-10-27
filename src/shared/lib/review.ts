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

/**
 * 復習対象が1回の出題数（20問・30問）に足りないときに補う問題。
 * 「何度も間違えた問題」と「本人がブックマークした問題」に限り、理由のはっきりしない問題
 * （未回答の問題など）では埋めない。補っても足りなければ、ある分だけ出題する。
 * 何度も間違えた問題でも、その後この回数だけ続けて正解していれば身についたとみなして外す。
 */
export const REPEATED_MISTAKE_MIN_COUNT = 2;
export const REPEATED_MISTAKE_GRADUATION_STREAK = 3;

export function isRepeatedMistake(progress: QuestionProgress): boolean {
  return (
    progress.incorrectCount >= REPEATED_MISTAKE_MIN_COUNT &&
    progress.correctStreak < REPEATED_MISTAKE_GRADUATION_STREAK
  );
}

/**
 * 補充に使う問題を優先順に並べる。
 * 1. 何度も間違えた問題で、ブックマークもしている問題
 * 2. 何度も間違えた問題
 * 3. ブックマークした問題（正解・不正解を問わない）
 * 同じ順位の中では、間違えた回数が多い問題、最後に答えたのが古い問題を先にする。
 */
export function selectReviewFillQuestionIds(allProgress: QuestionProgress[]): string[] {
  const rank = (p: QuestionProgress): number => {
    const repeated = isRepeatedMistake(p);
    if (repeated && p.bookmarked) return 0;
    if (repeated) return 1;
    if (p.bookmarked) return 2;
    return -1;
  };
  return allProgress
    .map((p) => ({ p, r: rank(p) }))
    .filter(({ r }) => r >= 0)
    .sort(
      (a, b) =>
        a.r - b.r ||
        b.p.incorrectCount - a.p.incorrectCount ||
        (a.p.lastAnsweredAt ?? "").localeCompare(b.p.lastAnsweredAt ?? ""),
    )
    .map(({ p }) => p.questionId);
}

export interface ComposedReviewSession {
  questionIds: string[];
  /** 補充した問題のID（questionIdsの部分集合）。 */
  supplementIds: string[];
}

/**
 * 復習対象（primaryIds）から最大limit問をランダムに選び、足りない分を
 * 補充候補（fillIds、優先順）から先頭順に補う。出題順は全体でシャッフルする。
 */
export function composeReviewSession(
  primaryIds: string[],
  fillIds: string[],
  limit: number,
  random: () => number = Math.random,
): ComposedReviewSession {
  const shuffle = <T>(items: T[]): T[] => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  };
  const primary = shuffle(primaryIds).slice(0, limit);
  const taken = new Set(primary);
  const supplementIds = fillIds.filter((id) => !taken.has(id)).slice(0, limit - primary.length);
  return { questionIds: shuffle([...primary, ...supplementIds]), supplementIds };
}

export interface ReviewBuckets {
  mockReview: string[];
  dueForReview: string[];
  wrongAnswer: string[];
  bookmarked: string[];
  /** 出題数に足りないときの補充候補（優先順）。 */
  fill: string[];
}

export async function getReviewBuckets(now: Date = new Date()): Promise<ReviewBuckets> {
  const allProgress = await listAllQuestionProgress();
  return {
    mockReview: selectMockReviewQuestionIds(allProgress),
    dueForReview: selectDueForReviewQuestionIds(allProgress, now),
    wrongAnswer: selectWrongAnswerQuestionIds(allProgress),
    bookmarked: selectBookmarkedQuestionIds(allProgress),
    fill: selectReviewFillQuestionIds(allProgress),
  };
}
