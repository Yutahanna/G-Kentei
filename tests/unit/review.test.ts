import { describe, expect, it } from "vitest";
import {
  selectBookmarkedQuestionIds,
  selectDueForReviewQuestionIds,
  selectWrongAnswerQuestionIds,
} from "../../src/shared/lib/review";
import { createInitialProgress } from "../../src/entities/progress";
import type { QuestionProgress } from "../../src/entities/progress";

function withHistory(
  questionId: string,
  entries: QuestionProgress["history"],
): QuestionProgress {
  return { ...createInitialProgress(questionId), attempts: entries.length, history: entries };
}

describe("review（復習対象の選定ロジック）", () => {
  it("nextReviewAtが現在時刻以前の問題だけをSRS復習対象として選ぶ", () => {
    const now = new Date("2026-08-01T00:00:00.000Z");
    const due: QuestionProgress = {
      ...createInitialProgress("q1"),
      status: "due_for_review",
      nextReviewAt: "2026-07-31T00:00:00.000Z",
    };
    const notYetDue: QuestionProgress = {
      ...createInitialProgress("q2"),
      status: "due_for_review",
      nextReviewAt: "2026-08-02T00:00:00.000Z",
    };
    const notStarted = createInitialProgress("q3");

    const result = selectDueForReviewQuestionIds([due, notYetDue, notStarted], now);
    expect(result).toEqual(["q1"]);
  });

  it("直近の回答が不正解だった問題だけを誤答復習対象として選ぶ", () => {
    const wrongLast = withHistory("q1", [
      { answeredAt: "2026-08-01T00:00:00.000Z", result: "correct", selectedIndex: 0 },
      { answeredAt: "2026-08-01T00:01:00.000Z", result: "incorrect", selectedIndex: 1 },
    ]);
    const correctLast = withHistory("q2", [
      { answeredAt: "2026-08-01T00:00:00.000Z", result: "incorrect", selectedIndex: 1 },
      { answeredAt: "2026-08-01T00:01:00.000Z", result: "correct", selectedIndex: 0 },
    ]);
    const unanswered = createInitialProgress("q3");

    const result = selectWrongAnswerQuestionIds([wrongLast, correctLast, unanswered]);
    expect(result).toEqual(["q1"]);
  });

  it("bookmarked=trueの問題だけをブックマーク対象として選ぶ", () => {
    const bookmarked: QuestionProgress = { ...createInitialProgress("q1"), bookmarked: true };
    const notBookmarked = createInitialProgress("q2");

    const result = selectBookmarkedQuestionIds([bookmarked, notBookmarked]);
    expect(result).toEqual(["q1"]);
  });
});
