import { create } from "zustand";

/**
 * 章別ドリルの実行中セッション状態。複数コンポーネント（出題画面・結果画面）が
 * 参照するがブラウザを閉じれば消えてよい揮発性の状態なのでZustandに置く。
 * 永続化が必要な回答結果はこのストアではなく shared/lib/db 経由でIndexedDBに保存する。
 */

export interface DrillAnswerRecord {
  questionId: string;
  selectedIndex: number;
  correct: boolean;
}

interface DrillSessionState {
  chapterId: string | null;
  questionIds: string[];
  currentIndex: number;
  answers: DrillAnswerRecord[];
  lastFeedback: DrillAnswerRecord | null;
  startSession: (chapterId: string, questionIds: string[]) => void;
  submitAnswer: (record: DrillAnswerRecord) => void;
  goToNext: () => void;
  resetSession: () => void;
}

export const useDrillSessionStore = create<DrillSessionState>((set) => ({
  chapterId: null,
  questionIds: [],
  currentIndex: 0,
  answers: [],
  lastFeedback: null,
  startSession: (chapterId, questionIds) =>
    set({
      chapterId,
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
      chapterId: null,
      questionIds: [],
      currentIndex: 0,
      answers: [],
      lastFeedback: null,
    }),
}));
