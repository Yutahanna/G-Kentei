import { describe, expect, it } from "vitest";
import {
  selectBookmarkedQuestionIds,
  selectDueForReviewQuestionIds,
  selectWrongAnswerQuestionIds,
  needsMockReview,
  selectMockReviewQuestionIds,
} from "../../src/shared/lib/review";
import { createInitialProgress } from "../../src/entities/progress";
import type { QuestionProgress } from "../../src/entities/progress";

function withHistory(questionId: string, entries: QuestionProgress["history"]): QuestionProgress {
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

  describe("模試の誤答・ブックマーク復習", () => {
    // n日後の正午（UTC）。タイムゾーンに関係なく別の日付になるよう12時を基準にする。
    const t = (n: number) => new Date(Date.UTC(2026, 9, 19 + n, 12)).toISOString();

    it("模試で誤答した問題は、その後別々の2日で続けて正解するまで対象に残る", () => {
      const wrong = {
        answeredAt: t(0),
        result: "incorrect",
        selectedIndex: 1,
        source: "mock_exam",
      } as const;
      const ok = (n: number) =>
        ({ answeredAt: t(n), result: "correct", selectedIndex: 0, source: "review" }) as const;
      const ng = (n: number) =>
        ({ answeredAt: t(n), result: "incorrect", selectedIndex: 2, source: "review" }) as const;

      expect(needsMockReview(withHistory("q", [wrong]))).toBe(true);
      expect(needsMockReview(withHistory("q", [wrong, ok(1)]))).toBe(true);
      expect(needsMockReview(withHistory("q", [wrong, ok(1), ok(2)]))).toBe(false);
      expect(needsMockReview(withHistory("q", [wrong, ok(1), ng(2), ok(3)]))).toBe(true);
      expect(needsMockReview(withHistory("q", [wrong, ok(1), ng(2), ok(3), ok(4)]))).toBe(false);
    });

    it("同じ日に何回正解しても1日と数え、対象から外さない", () => {
      const wrong = {
        answeredAt: t(0),
        result: "incorrect",
        selectedIndex: 1,
        source: "mock_exam",
      } as const;
      const okAt = (answeredAt: string) =>
        ({ answeredAt, result: "correct", selectedIndex: 0, source: "review" }) as const;
      const day1 = (minute: number) => new Date(Date.UTC(2026, 9, 20, 12, minute)).toISOString();

      expect(
        needsMockReview(withHistory("q", [wrong, okAt(day1(0)), okAt(day1(5)), okAt(day1(10))])),
      ).toBe(true);
      expect(
        needsMockReview(withHistory("q", [wrong, okAt(day1(0)), okAt(day1(5)), okAt(t(2))])),
      ).toBe(false);
    });

    it("ドリルだけの誤答や、記録元の無い古い履歴は対象にしない", () => {
      expect(
        needsMockReview(
          withHistory("q", [
            { answeredAt: t(0), result: "incorrect", selectedIndex: 1, source: "drill" },
          ]),
        ),
      ).toBe(false);
      expect(
        needsMockReview(
          withHistory("q", [{ answeredAt: t(0), result: "incorrect", selectedIndex: 1 }]),
        ),
      ).toBe(false);
    });

    it("ブックマークした問題は正誤にかかわらず対象に含める", () => {
      const bookmarked = { ...createInitialProgress("b"), bookmarked: true };
      const mockWrong = withHistory("m", [
        { answeredAt: t(0), result: "incorrect", selectedIndex: -1, source: "mock_exam" },
      ]);
      const other = createInitialProgress("o");
      expect(selectMockReviewQuestionIds([bookmarked, mockWrong, other])).toEqual(["b", "m"]);
    });
  });
});
