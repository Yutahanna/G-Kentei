import { describe, expect, it } from "vitest";
import { applyAnswer, MAX_SRS_STAGE, SRS_STAGE_INTERVALS_DAYS } from "../../src/shared/lib/srs";
import { createInitialProgress } from "../../src/entities/progress";

const NOW = new Date("2026-08-01T00:00:00.000Z");

describe("srs.applyAnswer", () => {
  it("初回正解で not_started から learning へ進み、段階が1つ進む", () => {
    const progress = createInitialProgress("q1");
    const next = applyAnswer(progress, "correct", 0, NOW);

    expect(next.status).toBe("learning");
    expect(next.srsStage).toBe(1);
    expect(next.attempts).toBe(1);
    expect(next.correctStreak).toBe(1);
    expect(next.nextReviewAt).toBe(
      new Date(NOW.getTime() + SRS_STAGE_INTERVALS_DAYS[1] * 86400000).toISOString(),
    );
  });

  it("正解を繰り返すと段階4で mastered になる", () => {
    let progress = createInitialProgress("q1");
    for (let i = 0; i < MAX_SRS_STAGE; i++) {
      progress = applyAnswer(progress, "correct", 0, NOW);
    }

    expect(progress.srsStage).toBe(MAX_SRS_STAGE);
    expect(progress.status).toBe("mastered");
  });

  it("初回誤答は段階0で早期再出題になる", () => {
    const progress = createInitialProgress("q1");
    const next = applyAnswer(progress, "incorrect", 2, NOW);

    expect(next.status).toBe("due_for_review");
    expect(next.srsStage).toBe(0);
    expect(next.incorrectCount).toBe(1);
    expect(next.correctStreak).toBe(0);
  });

  it("連続誤答は段階0に戻る（早期再出題）", () => {
    let progress = createInitialProgress("q1");
    progress = applyAnswer(progress, "correct", 0, NOW); // stage 1
    progress = applyAnswer(progress, "correct", 0, NOW); // stage 2
    progress = applyAnswer(progress, "incorrect", 1, NOW); // 1回目の誤答: stage 2->0 (drop 2)
    const beforeSecondWrong = progress.srsStage;
    progress = applyAnswer(progress, "incorrect", 1, NOW); // 連続誤答: 早期再出題で0

    expect(beforeSecondWrong).toBe(0);
    expect(progress.srsStage).toBe(0);
  });

  it("非連続の誤答は段階0へ戻さず1〜2段階だけ下げる", () => {
    let progress = createInitialProgress("q1");
    // stage を 3 まで育てる（正解を3回）
    progress = applyAnswer(progress, "correct", 0, NOW); // stage1
    progress = applyAnswer(progress, "correct", 0, NOW); // stage2
    progress = applyAnswer(progress, "correct", 0, NOW); // stage3
    expect(progress.srsStage).toBe(3);

    // 誤答（直前は正解なので「連続誤答」ではない）: 2段階下げて1になる
    progress = applyAnswer(progress, "incorrect", 1, NOW);
    expect(progress.srsStage).toBe(1);
    expect(progress.status).toBe("due_for_review");
    expect(progress.correctStreak).toBe(0);
  });

  it("回答履歴が記録される", () => {
    let progress = createInitialProgress("q1");
    progress = applyAnswer(progress, "correct", 2, NOW);
    progress = applyAnswer(progress, "incorrect", 1, NOW);

    expect(progress.history).toHaveLength(2);
    expect(progress.history[0]).toMatchObject({ result: "correct", selectedIndex: 2 });
    expect(progress.history[1]).toMatchObject({ result: "incorrect", selectedIndex: 1 });
  });
});
