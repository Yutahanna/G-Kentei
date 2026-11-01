import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChoiceOrderMap } from "../lib/choiceOrder";
import {
  migrateAnswerListState,
  SESSION_STATE_VERSION,
  sessionStateStorage,
} from "./sessionPersistence";

/**
 * 章別ドリルの実行中セッション状態。複数コンポーネント（出題画面・結果画面）が
 * 参照する状態なのでZustandに置き、ページを読み込み直しても続きから再開できるよう
 * タブ単位で保存する（sessionPersistence.ts）。
 * 永続化が必要な回答結果はこのストアではなく shared/lib/db 経由でIndexedDBに保存する。
 */

export interface DrillAnswerRecord {
  questionId: string;
  /** 選んだ選択肢の元インデックス（1つを選ぶ問題では1要素）。 */
  selected: number[];
  correct: boolean;
}

interface DrillSessionState {
  chapterId: string | null;
  questionIds: string[];
  currentIndex: number;
  answers: DrillAnswerRecord[];
  lastFeedback: DrillAnswerRecord | null;
  /** 選択肢の表示順。開始時に1回だけ決め、読み込み直しても同じ並びを使う。 */
  choiceOrderMap: ChoiceOrderMap;
  /** 結果を学習履歴に記録済みか。結果画面を読み込み直しても二重に記録しないためのフラグ。 */
  isRecorded: boolean;
  startSession: (chapterId: string, questionIds: string[], choiceOrderMap?: ChoiceOrderMap) => void;
  submitAnswer: (record: DrillAnswerRecord) => void;
  goToNext: () => void;
  markRecorded: () => void;
  resetSession: () => void;
}

export const useDrillSessionStore = create<DrillSessionState>()(
  persist(
    (set) => ({
      chapterId: null,
      questionIds: [],
      currentIndex: 0,
      answers: [],
      lastFeedback: null,
      choiceOrderMap: {},
      isRecorded: false,
      startSession: (chapterId, questionIds, choiceOrderMap = {}) =>
        set({
          chapterId,
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
          chapterId: null,
          questionIds: [],
          currentIndex: 0,
          answers: [],
          lastFeedback: null,
          choiceOrderMap: {},
          isRecorded: false,
        }),
    }),
    {
      name: "g-kentei-drill-session",
      storage: sessionStateStorage,
      version: SESSION_STATE_VERSION,
      migrate: (persisted) => migrateAnswerListState(persisted) as never,
    },
  ),
);
