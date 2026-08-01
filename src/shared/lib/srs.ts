import type { QuestionProgress } from "../../entities/progress";

/**
 * 間隔反復（SRS）ロジック。docs/phase0-design.md 8.4節の簡易Leitner方式を実装する。
 *
 * - 復習段階は0〜4の5段階固定間隔。
 * - 正解: 段階を1つ進める。段階4に到達したら習得済みとする。
 * - 誤答: 段階を0へ戻さず原則1〜2段階下げる。ただし初回誤答・連続誤答は早期再出題（段階0）とする。
 *
 * UI・問題データに依存しない純粋関数として実装し、将来別のSRSアルゴリズムへ
 * 差し替えられるようにする（依存するのは QuestionProgress の形だけ）。
 */

export const SRS_STAGE_INTERVALS_DAYS = [1, 3, 7, 14, 30] as const;
export const MAX_SRS_STAGE = SRS_STAGE_INTERVALS_DAYS.length - 1;

function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

/** srsStageは常に0〜MAX_SRS_STAGEの範囲で構築されるため、配列アクセスは必ず成功する。 */
function intervalDaysForStage(stage: number): number {
  const interval = SRS_STAGE_INTERVALS_DAYS[stage];
  if (interval === undefined) {
    throw new Error(`不正なSRS段階です: ${stage}`);
  }
  return interval;
}

function computeNextStageOnIncorrect(progress: QuestionProgress): number {
  const isFirstAttempt = progress.attempts === 0;
  const lastEntry = progress.history[progress.history.length - 1];
  const isConsecutiveWrong = lastEntry !== undefined && lastEntry.result === "incorrect";

  if (isFirstAttempt || isConsecutiveWrong) {
    return 0;
  }

  const drop = progress.srsStage >= 2 ? 2 : progress.srsStage;
  return Math.max(progress.srsStage - drop, 0);
}

export function applyAnswer(
  progress: QuestionProgress,
  result: "correct" | "incorrect",
  selectedIndex: number,
  now: Date = new Date(),
): QuestionProgress {
  const nowIso = now.toISOString();
  const history = [...progress.history, { answeredAt: nowIso, result, selectedIndex }];

  if (result === "correct") {
    const srsStage = Math.min(progress.srsStage + 1, MAX_SRS_STAGE);
    const status = srsStage === MAX_SRS_STAGE ? "mastered" : "learning";
    return {
      ...progress,
      status,
      srsStage,
      attempts: progress.attempts + 1,
      correctStreak: progress.correctStreak + 1,
      lastAnsweredAt: nowIso,
      nextReviewAt: addDays(now, intervalDaysForStage(srsStage)).toISOString(),
      history,
    };
  }

  const srsStage = computeNextStageOnIncorrect(progress);
  return {
    ...progress,
    status: "due_for_review",
    srsStage,
    attempts: progress.attempts + 1,
    incorrectCount: progress.incorrectCount + 1,
    correctStreak: 0,
    lastAnsweredAt: nowIso,
    nextReviewAt: addDays(now, intervalDaysForStage(srsStage)).toISOString(),
    history,
  };
}

export function isDueForReview(progress: QuestionProgress, now: Date = new Date()): boolean {
  if (progress.status === "not_started" || progress.nextReviewAt === null) {
    return false;
  }
  return new Date(progress.nextReviewAt).getTime() <= now.getTime();
}
