import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChoiceOrderMap } from "../lib/choiceOrder";
import { sessionStateStorage } from "./sessionPersistence";

/**
 * 復習セッション（SRS復習・誤答復習・ブックマーク）の実行中状態。
 * drillSessionStoreと異なり、章をまたいだ問題IDの並びを保持する。
 * ページを読み込み直しても続きから再開できるようタブ単位で保存する（sessionPersistence.ts）。
 */

export type ReviewSessionType = "mock_review" | "due_for_review" | "wrong_answer" | "bookmarked";

export interface ReviewAnswerRecord {
  questionId: string;
  selectedIndex: number;
  correct: boolean;
}

interface ReviewSessionState {
  sessionType: ReviewSessionType | null;
  questionIds: string[];
  currentIndex: number;
  answers: ReviewAnswerRecord[];
  lastFeedback: ReviewAnswerRecord | null;
  /** 選択肢の表示順。開始時に1回だけ決め、読み込み直しても同じ並びを使う。 */
  choiceOrderMap: ChoiceOrderMap;
  /** 結果を学習履歴に記録済みか。結果画面を読み込み直しても二重に記録しないためのフラグ。 */
  isRecorded: boolean;
  startSession: (
    sessionType: ReviewSessionType,
    questionIds: string[],
    choiceOrderMap?: ChoiceOrderMap,
  ) => void;
  submitAnswer: (record: ReviewAnswerRecord) => void;
  goToNext: () => void;
  markRecorded: () => void;
  resetSession: () => void;
}

export const useReviewSessionStore = create<ReviewSessionState>()(
  persist(
    (set) => ({
      sessionType: null,
      questionIds: [],
      currentIndex: 0,
      answers: [],
      lastFeedback: null,
      choiceOrderMap: {},
      isRecorded: false,
      startSession: (sessionType, questionIds, choiceOrderMap = {}) =>
        set({
          sessionType,
          questionIds,
          currentIndex: 0,
          answers: [],
          lastFeedback: null,
          choiceOrderMap,
          isRecorded: false,
        }),
      submitAnswer: (record) =>
        set((state) => ({
          answers: [...state.answers, record],
          lastFeedback: record,
        })),
      goToNext: () =>
        set((state) => ({
          currentIndex: state.currentIndex + 1,
          lastFeedback: null,
        })),
      markRecorded: () => set({ isRecorded: true }),
      resetSession: () =>
        set({
          sessionType: null,
          questionIds: [],
          currentIndex: 0,
          answers: [],
          lastFeedback: null,
          choiceOrderMap: {},
          isRecorded: false,
        }),
    }),
    { name: "g-kentei-review-session", storage: sessionStateStorage },
  ),
);
