import { z } from "zod";

/**
 * 教材Markdown（materials/chapters/*.md）をビルド時に変換した構造化コンテンツのスキーマ。
 * scripts/build-content.ts が生成し、アプリ実行時はこのスキーマに従うJSONのみを読み込む。
 */

export const sectionSchema = z.object({
  sectionId: z.string().regex(/^ch\d{2}-s\d{2}$/),
  index: z.number().int().positive(),
  title: z.string().min(1),
  introType: z.enum(["image", "concise"]),
  introText: z.string().min(1),
  mechanismText: z.string().min(1).optional(),
  keyPoints: z.array(z.string().min(1)).min(1),
});

export const supplementaryTermSchema = z.object({
  term: z.string().min(1),
  importance: z.enum(["A", "B", "C"]),
  description: z.string().min(1),
});

export const keyDistinctionSchema = z.object({
  item: z.string().min(1),
  criterion: z.string().min(1),
});

export const chapterSummarySchema = z.object({
  conceptMap: z.string().min(1),
  supplementaryTerms: z.array(supplementaryTermSchema),
  keyDistinctions: z.array(keyDistinctionSchema),
  checkpoints: z.array(z.string().min(1)),
});

export const chapterSchema = z.object({
  chapterId: z.string().regex(/^ch\d{2}$/),
  number: z.number().int().positive(),
  title: z.string().min(1),
  sourceFile: z.string().min(1),
  contentHash: z.string().min(1),
  recommendedOrderIndex: z.number().int().nonnegative(),
  learningGoals: z.array(z.string().min(1)).min(1),
  sections: z.array(sectionSchema).min(1),
  transitionNote: z.string().min(1).optional(),
  summary: chapterSummarySchema,
});

export const manifestChapterEntrySchema = z.object({
  chapterId: z.string().regex(/^ch\d{2}$/),
  title: z.string().min(1),
  sourceFile: z.string().min(1),
  contentHash: z.string().min(1),
  sectionIds: z.array(z.string().regex(/^ch\d{2}-s\d{2}$/)).min(1),
});

export const manifestSchema = z.object({
  generatedAt: z.string().min(1),
  chapters: z.array(manifestChapterEntrySchema),
});

export type Section = z.infer<typeof sectionSchema>;
export type ChapterSummary = z.infer<typeof chapterSummarySchema>;
export type Chapter = z.infer<typeof chapterSchema>;
export type Manifest = z.infer<typeof manifestSchema>;
