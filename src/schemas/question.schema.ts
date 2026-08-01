import { z } from "zod";

/**
 * questions/**\/*.json の各問題データが満たすべきスキーマ。
 * CLAUDE.md記載の必須項目、およびdocs/phase0-design.md 8.2〜8.3節のタグ体系・時点管理方針に対応する。
 */

export const difficultySchema = z.enum(["basic", "standard", "advanced"]);

export const reviewStatusSchema = z.enum(["draft", "reviewed"]);

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
    tags: z.array(z.string().min(1)).min(1),
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
export type Question = z.infer<typeof questionSchema>;
