import { z } from "zod";

/**
 * IndexedDBに保存する学習履歴・進捗のZodスキーマ。
 * entities/progress.tsの型定義に対応する。エクスポート済みJSONを
 * インポートする際、外部ファイル由来の未検証データをDBに書き込む前の
 * 検証境界として使う。
 */

export const answerHistoryEntrySchema = z.object({
  answeredAt: z.string().min(1),
  result: z.enum(["correct", "incorrect"]),
  selectedIndex: z.number().int(),
});

export const questionProgressSchema = z.object({
  questionId: z.string().min(1),
  status: z.enum(["not_started", "learning", "due_for_review", "mastered"]),
  srsStage: z.number().int().min(0).max(4),
  attempts: z.number().int().min(0),
  incorrectCount: z.number().int().min(0),
  correctStreak: z.number().int().min(0),
  lastAnsweredAt: z.string().nullable(),
  nextReviewAt: z.string().nullable(),
  bookmarked: z.boolean(),
  history: z.array(answerHistoryEntrySchema),
});

export const studySessionLogSchema = z.object({
  sessionId: z.string().min(1),
  type: z.enum(["drill", "review", "mock_exam", "material_reading"]),
  startedAt: z.string().min(1),
  endedAt: z.string().nullable(),
  chapterIds: z.array(z.string()),
  questionIds: z.array(z.string()),
  scoreSummary: z.object({ correct: z.number().int(), total: z.number().int() }).optional(),
});

export const materialReadStateSchema = z.object({
  sectionId: z.string().min(1),
  readAt: z.string().nullable(),
});

export const userSettingsSchema = z.object({
  id: z.literal("singleton"),
  theme: z.enum(["light", "dark", "system"]),
  keyboardShortcutsEnabled: z.boolean(),
});

export const exportedDataSchema = z.object({
  exportedAt: z.string().min(1),
  questionProgress: z.array(questionProgressSchema),
  studySessionLog: z.array(studySessionLogSchema),
  materialReadState: z.array(materialReadStateSchema),
  userSettings: userSettingsSchema,
});

export type ExportedDataInput = z.infer<typeof exportedDataSchema>;
