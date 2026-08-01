import { z } from "zod";

/**
 * questions/**\/*.json の各問題データが満たすべきスキーマ。
 * CLAUDE.md記載の必須項目、およびdocs/phase0-design.md 8.2〜8.3節のタグ体系・時点管理方針に対応する。
 *
 * tags は表示用（contentTags）と内部管理用（skillTags / crossChapterTags）を区別する。
 * - contentTags: 個別概念タグ（例: AI効果、チューリングテスト、中国語の部屋）。学習者向けUIで表示しうる。
 * - skillTags: 出題意図の分類（暗記／比較／関係性／適用判断）。著者・レビュー用の内部管理タグ。
 * - crossChapterTags: 章横断の伏線・接続の注記（例: 第2章のフレーム問題への伏線）。内部管理タグ。
 * chapterId/sectionId で章・節は既に構造化されているため、tags には章タグを重複させない。
 */

export const difficultySchema = z.enum(["basic", "standard", "advanced"]);

export const reviewStatusSchema = z.enum(["draft", "approved", "needs_revision"]);

export const skillTagSchema = z.enum(["暗記", "比較", "関係性", "適用判断"]);

export const questionTagsSchema = z
  .object({
    contentTags: z.array(z.string().min(1)).min(1),
    skillTags: z.array(skillTagSchema).min(1),
    crossChapterTags: z.array(z.string().min(1)).default([]),
  })
  .strict();

export const questionSchema = z
  .object({
    id: z.string().min(1),
    chapterId: z.string().regex(/^ch\d{2}$/),
    sectionId: z.string().regex(/^ch\d{2}-s\d{2}$/),
    difficulty: difficultySchema,
    question: z.string().min(1),
    choices: z.array(z.string().min(1)).length(4),
    correctAnswer: z.number().int().min(0).max(3),
    explanation: z.string().min(1),
    choiceExplanations: z.array(z.string().min(1)).length(4),
    tags: questionTagsSchema,
    sourceFile: z.string().min(1),
    sourceHeading: z.string().min(1),
    sourceReference: z.string().min(1),
    contentVersion: z.string().min(1),
    asOfDate: z.string().min(1).optional(),
    createdAt: z.string().min(1),
    reviewStatus: reviewStatusSchema,
  })
  .strict();

export type Difficulty = z.infer<typeof difficultySchema>;
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export type SkillTag = z.infer<typeof skillTagSchema>;
export type QuestionTags = z.infer<typeof questionTagsSchema>;
export type Question = z.infer<typeof questionSchema>;
