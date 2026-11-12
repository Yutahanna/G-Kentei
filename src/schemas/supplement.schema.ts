import { z } from "zod";

/**
 * 補遺（materials/supplements/*_ORG.md）をビルド時に変換した構造化コンテンツのスキーマ。
 * scripts/build-supplements.ts が content/supplements.json を生成し、
 * アプリは章のページの最後に、その章に割り当てた補遺の項目を表示する。
 *
 * 補遺は格納テキスト（materials/chapters/）とは別の、独自に作成した資料である。
 * 章本文のスキーマ（content.schema.ts）とは分け、画面でも章本文と区別して表示する。
 */

export const supplementInlineSchema = z.object({
  t: z.enum(["text", "strong", "code"]),
  v: z.string(),
});

export type SupplementInline = z.infer<typeof supplementInlineSchema>;

export type SupplementNode =
  | { type: "paragraph"; inlines: SupplementInline[] }
  | {
      type: "list";
      ordered: boolean;
      items: { inlines: SupplementInline[]; children: SupplementNode[] }[];
    }
  | { type: "table"; header: SupplementInline[][]; rows: SupplementInline[][][] };

export const supplementNodeSchema: z.ZodType<SupplementNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("paragraph"), inlines: z.array(supplementInlineSchema) }),
    z.object({
      type: z.literal("list"),
      ordered: z.boolean(),
      items: z.array(
        z.object({
          inlines: z.array(supplementInlineSchema),
          children: z.array(supplementNodeSchema),
        }),
      ),
    }),
    z.object({
      type: z.literal("table"),
      header: z.array(z.array(supplementInlineSchema)),
      rows: z.array(z.array(z.array(supplementInlineSchema))),
    }),
  ]),
);

export const supplementEntrySchema = z.object({
  /** 画面内アンカーに使うID（例: "sup-6-2-1a2b3c4d"）。補遺ファイル名と見出しから決まる。 */
  blockId: z.string().regex(/^sup-[\w-]+$/),
  sourceFile: z.string().min(1),
  /** 補遺の名前（例: "音声処理"） */
  supplementTitle: z.string().min(1),
  /** "term" は ### の用語、"intro" は ## の直下にある表や段落 */
  kind: z.enum(["term", "intro"]),
  /** 補遺の見出しそのまま（問題データの sourceHeading と照合する） */
  heading: z.string().min(1),
  /** 画面に出す見出し（ページ番号などの括弧書きを除いたもの） */
  title: z.string().min(1),
  /** 項目が属する ## の見出し（番号とページを除いたもの）。intro では title と同じ */
  groupTitle: z.string().min(1),
  /** 公式テキストのページ（例: "p.272"）。ないときは省略 */
  pageRef: z.string().min(1).optional(),
  /** 表示する章の節（例: "ch06-s04"） */
  sectionId: z.string().regex(/^ch\d{2}-s\d{2}$/),
  body: z.array(supplementNodeSchema).min(1),
  /** 法律・倫理など更新されうる内容の確認基準日（YYYY-MM-DD） */
  asOfDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const supplementSourceSchema = z.object({
  sourceFile: z.string().min(1),
  title: z.string().min(1),
  contentHash: z.string().min(1),
});

export const supplementContentSchema = z.object({
  generatedAt: z.string().min(1),
  sources: z.array(supplementSourceSchema),
  entries: z.array(supplementEntrySchema),
});

export type SupplementEntry = z.infer<typeof supplementEntrySchema>;
export type SupplementContent = z.infer<typeof supplementContentSchema>;
