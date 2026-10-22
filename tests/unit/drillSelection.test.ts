import { describe, expect, it } from "vitest";
import { drillPriority, selectDrillQuestionIds } from "../../src/shared/lib/drillSelection";
import { createInitialProgress } from "../../src/entities/progress";
import type { QuestionProgress } from "../../src/entities/progress";

function progress(
  questionId: string,
  fields: Partial<QuestionProgress>,
): [string, QuestionProgress] {
  return [questionId, { ...createInitialProgress(questionId), ...fields }];
}

const IDS = ["q1", "q2", "q3", "q4", "q5", "q6"];

describe("drillSelection（章別ドリルの出題選定）", () => {
  it("優先度：直近誤答 < 連続正解2回未満の過去誤答 < 未回答 < 安定して正解", () => {
    expect(drillPriority({ ...createInitialProgress("a"), attempts: 2, correctStreak: 0 })).toBe(0);
    expect(
      drillPriority({
        ...createInitialProgress("a"),
        attempts: 3,
        incorrectCount: 1,
        correctStreak: 1,
      }),
    ).toBe(1);
    expect(drillPriority(undefined)).toBe(2);
    expect(drillPriority(createInitialProgress("a"))).toBe(2);
    expect(drillPriority({ ...createInitialProgress("a"), attempts: 1, correctStreak: 1 })).toBe(3);
    expect(
      drillPriority({
        ...createInitialProgress("a"),
        attempts: 4,
        incorrectCount: 1,
        correctStreak: 2,
      }),
    ).toBe(3);
  });

  it("出題数を超える問題があるときは、弱い問題から指定数だけ選び、教材順に並べる", () => {
    const progressById = new Map([
      progress("q1", { attempts: 2, correctStreak: 2, lastAnsweredAt: "2026-10-01T00:00:00Z" }),
      progress("q2", { attempts: 1, correctStreak: 1, lastAnsweredAt: "2026-10-02T00:00:00Z" }),
      progress("q4", { attempts: 3, incorrectCount: 1, correctStreak: 1 }),
      progress("q6", { attempts: 1, incorrectCount: 1, correctStreak: 0 }),
    ]);
    // 優先順：q6（直近誤答）→ q4（過去誤答）→ q3, q5（未回答）→ q2（連続正解1）→ q1
    expect(selectDrillQuestionIds(IDS, progressById, 3, false)).toEqual(["q3", "q4", "q6"]);
    expect(selectDrillQuestionIds(IDS, progressById, 5, false)).toEqual([
      "q2",
      "q3",
      "q4",
      "q5",
      "q6",
    ]);
  });

  it("安定して正解している問題同士は、最後に答えたのが古い問題を先に選ぶ", () => {
    const progressById = new Map(
      IDS.map((id, i) =>
        progress(id, {
          attempts: 2,
          correctStreak: 2,
          lastAnsweredAt: `2026-10-0${6 - i}T00:00:00Z`,
        }),
      ),
    );
    expect(selectDrillQuestionIds(IDS, progressById, 2, false)).toEqual(["q5", "q6"]);
  });

  it("全問（null）や出題数が問題数以上のときは全問を出す", () => {
    expect(selectDrillQuestionIds(IDS, new Map(), null, false)).toEqual(IDS);
    expect(selectDrillQuestionIds(IDS, new Map(), 10, false)).toEqual(IDS);
  });

  it("ランダム化しても選ばれる問題は弱い問題のまま、順序だけが変わる", () => {
    const progressById = new Map([
      progress("q2", { attempts: 1, correctStreak: 0 }),
      progress("q5", { attempts: 1, correctStreak: 0 }),
      ...IDS.filter((id) => id !== "q2" && id !== "q5").map((id) =>
        progress(id, { attempts: 3, correctStreak: 3 }),
      ),
    ]);
    let seed = 1;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 20; i++) {
      const selected = selectDrillQuestionIds(IDS, progressById, 2, true, random);
      expect([...selected].sort()).toEqual(["q2", "q5"]);
    }
  });
});
