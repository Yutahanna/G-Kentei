import { create } from "zustand";

/**
 * 模擬試験の実行中状態。ドリルと異なり、正誤はその場で表示せず、
 * 全問題を対象に「回答（選択肢インデックス）」と「後で確認フラグ」だけを保持する。
 * 採点は結果画面でshared/lib/examScoring.tsを使って行う。
 */

export interface ExamAnswerState {
  selectedIndex: number | null;
  flagged: boolean;
}

interface ExamSessionState {
  questionIds: string[];
  answers: Record<string, ExamAnswerState>;
  currentIndex: number;
  timeLimitMinutes: number;
  startedAt: string | null;
  isSubmitted: boolean;
  startSession: (questionIds: string[], timeLimitMinutes: number) => void;
  selectAnswer: (questionId: string, index: number) => void;
  toggleFlag: (questionId: string) => void;
  goTo: (index: number) => void;
  submit: () => void;
  resetSession: () => void;
}

function emptyAnswers(questionIds: string[]): Record<string, ExamAnswerState> {
  return Object.fromEntries(questionIds.map((id) => [id, { selectedIndex: null, flagged: false }]));
}

export const useExamSessionStore = create<ExamSessionState>((set) => ({
  questionIds: [],
  answers: {},
  currentIndex: 0,
  timeLimitMinutes: 0,
  startedAt: null,
  isSubmitted: false,
  startSession: (questionIds, timeLimitMinutes) =>
    set({
      questionIds,
      answers: emptyAnswers(questionIds),
      currentIndex: 0,
      timeLimitMinutes,
      startedAt: new Date().toISOString(),
      isSubmitted: false,
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
  resetSession: () =>
    set({
      questionIds: [],
      answers: {},
      currentIndex: 0,
      timeLimitMinutes: 0,
      startedAt: null,
      isSubmitted: false,
    }),
}));
