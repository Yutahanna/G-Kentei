import { create } from "zustand";

/**
 * 復習セッション（SRS復習・誤答復習・ブックマーク）の実行中状態。
 * drillSessionStoreと異なり、章をまたいだ問題IDの並びを保持する。
 */

export type ReviewSessionType = "due_for_review" | "wrong_answer" | "bookmarked";

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
  startSession: (sessionType: ReviewSessionType, questionIds: string[]) => void;
  submitAnswer: (record: ReviewAnswerRecord) => void;
  goToNext: () => void;
  resetSession: () => void;
}

export const useReviewSessionStore = create<ReviewSessionState>((set) => ({
  sessionType: null,
  questionIds: [],
  currentIndex: 0,
  answers: [],
  lastFeedback: null,
  startSession: (sessionType, questionIds) =>
    set({
      sessionType,
      questionIds,
      currentIndex: 0,
      answers: [],
      lastFeedback: null,
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
  resetSession: () =>
    set({
      sessionType: null,
      questionIds: [],
      currentIndex: 0,
      answers: [],
      lastFeedback: null,
    }),
}));
