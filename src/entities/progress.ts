/**
 * IndexedDBに永続化する学習履歴・進捗の型定義。
 * docs/phase0-design.md 8.4節（SRS）・8.6節（その他の永続データ）に対応する。
 */

export type ProgressStatus = "not_started" | "learning" | "due_for_review" | "mastered";

export interface AnswerHistoryEntry {
  answeredAt: string;
  result: "correct" | "incorrect";
  selectedIndex: number;
}

export interface QuestionProgress {
  questionId: string;
  status: ProgressStatus;
  srsStage: number; // 0-4
  attempts: number;
  incorrectCount: number;
  correctStreak: number;
  lastAnsweredAt: string | null;
  nextReviewAt: string | null;
  bookmarked: boolean;
  history: AnswerHistoryEntry[];
}

export function createInitialProgress(questionId: string): QuestionProgress {
  return {
    questionId,
    status: "not_started",
    srsStage: 0,
    attempts: 0,
    incorrectCount: 0,
    correctStreak: 0,
    lastAnsweredAt: null,
    nextReviewAt: null,
    bookmarked: false,
    history: [],
  };
}

export interface StudySessionLog {
  sessionId: string;
  type: "drill" | "review" | "mock_exam" | "material_reading";
  startedAt: string;
  endedAt: string | null;
  chapterIds: string[];
  questionIds: string[];
  scoreSummary?: { correct: number; total: number };
}

export interface MaterialReadState {
  sectionId: string;
  readAt: string | null;
}

export type ThemeSetting = "light" | "dark" | "system";

export interface UserSettings {
  id: "singleton";
  theme: ThemeSetting;
  keyboardShortcutsEnabled: boolean;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  id: "singleton",
  theme: "system",
  keyboardShortcutsEnabled: true,
};
