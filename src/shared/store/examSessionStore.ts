import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChoiceOrderMap } from "../lib/choiceOrder";
import { sessionStateStorage } from "./sessionPersistence";

/**
 * 模擬試験の実行中状態。ドリルと異なり、正誤はその場で表示せず、
 * 全問題を対象に「回答（選択肢インデックス）」と「後で確認フラグ」だけを保持する。
 * 採点は結果画面でshared/lib/examScoring.tsを使って行う。
 * 選択肢の表示順も保持し、結果画面で受験中と同じ並びを再現する。
 * ページを読み込み直しても続きから再開できるようタブ単位で保存する（sessionPersistence.ts）。
 * 残り時間は開始時刻から計算するため、読み込み直している間も時間は進む。
 */

export interface ExamAnswerState {
  selectedIndex: number | null;
  flagged: boolean;
}

interface ExamSessionState {
  questionIds: string[];
  answers: Record<string, ExamAnswerState>;
  choiceOrderMap: ChoiceOrderMap;
  currentIndex: number;
  timeLimitMinutes: number;
  startedAt: string | null;
  isSubmitted: boolean;
  /** 結果を学習履歴に記録済みか。結果画面を開き直しても二重に記録しないためのフラグ。 */
  isRecorded: boolean;
  startSession: (
    questionIds: string[],
    timeLimitMinutes: number,
    choiceOrderMap?: ChoiceOrderMap,
  ) => void;
  selectAnswer: (questionId: string, index: number) => void;
  toggleFlag: (questionId: string) => void;
  goTo: (index: number) => void;
  submit: () => void;
  markRecorded: () => void;
  resetSession: () => void;
}

function emptyAnswers(questionIds: string[]): Record<string, ExamAnswerState> {
  return Object.fromEntries(questionIds.map((id) => [id, { selectedIndex: null, flagged: false }]));
}

export const useExamSessionStore = create<ExamSessionState>()(
  persist(
    (set) => ({
      questionIds: [],
      answers: {},
      choiceOrderMap: {},
      currentIndex: 0,
      timeLimitMinutes: 0,
      startedAt: null,
      isSubmitted: false,
      isRecorded: false,
      startSession: (questionIds, timeLimitMinutes, choiceOrderMap = {}) =>
        set({
          questionIds,
          answers: emptyAnswers(questionIds),
          choiceOrderMap,
          currentIndex: 0,
          timeLimitMinutes,
          startedAt: new Date().toISOString(),
          isSubmitted: false,
          isRecorded: false,
        }),
      selectAnswer: (questionId, index) =>
        set((state) => ({
          answers: {
            ...state.answers,
            [questionId]: {
              ...state.answers[questionId],
              selectedIndex: index,
              flagged: state.answers[questionId]?.flagged ?? false,
            },
          },
        })),
      toggleFlag: (questionId) =>
        set((state) => ({
          answers: {
            ...state.answers,
            [questionId]: {
              selectedIndex: state.answers[questionId]?.selectedIndex ?? null,
              flagged: !(state.answers[questionId]?.flagged ?? false),
            },
          },
        })),
      goTo: (index) => set({ currentIndex: index }),
      submit: () => set({ isSubmitted: true }),
      markRecorded: () => set({ isRecorded: true }),
      resetSession: () =>
        set({
          questionIds: [],
          answers: {},
          choiceOrderMap: {},
          currentIndex: 0,
          timeLimitMinutes: 0,
          startedAt: null,
          isSubmitted: false,
          isRecorded: false,
        }),
    }),
    { name: "g-kentei-exam-session", storage: sessionStateStorage },
  ),
);
