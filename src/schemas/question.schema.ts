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

/**
 * 設問文が肯定形（「合致するものはどれか」）か否定形（「合致しないものはどれか」
 * 「適切でないものはどれか」）かを区別するフィールド。省略時は肯定形として扱う
 * （既存問題の後方互換のため必須にはしない）。
 * 全問が肯定形に偏ると、設問文を読まず選択肢の見た目だけで解けてしまうため導入した。
 */
export const questionFormSchema = z.enum(["affirmative", "negative"]);

/**
 * 設問の見せ方（出題スタイル）を区別するフィールド。省略時は"standard"
 * （通常の4択・完全文選択式）として扱う（既存問題の後方互換のため必須にはしない）。
 * "fill_in_blank": 設問文中に空欄（全角丸括弧の中を空白にした単一空欄表記、または
 * 「（ア）」「（イ）」「（あ）」「（い）」等のラベル付き空欄表記）を含み、選択肢が
 * その空欄に入る語句・語句の組み合わせの候補となる出題スタイル。スキーマ・採点
 * ロジックはstandardと完全に同一（choices 4件からcorrectAnswerを選ぶ）で、
 * question／choicesの文面の書き方だけが異なる。JDLA公式サイトの例題・購入教材の
 * 双方にこの出題スタイルが存在することを実物で確認済み（確認基準日: 2026-09-26。
 * 公開されている出題比率の統計は確認できていない）。
 */
export const questionStyleSchema = z.enum(["standard", "fill_in_blank"]);

/**
 * 解答の形式。省略時は"single"（4択から1つを選ぶ。correctAnswerで正解を示す）。
 * "multiple": 当てはまるものを全て選ぶ形式（「適切なものを全て選べ」「適切なものをいくつでも選べ」）。
 * correctAnswersで正解を2〜3個示し、選んだ組が正解と完全に一致した場合だけ正解とする（部分点なし。
 * 本試験の採点方法は公表されていないため）。
 * 形式は公式テキストの章末問題（第7章の6問）に合わせた: 指示は「全て選べ」「いくつでも選べ」、
 * 選択肢は主に4つ（6つが1問）、正解は2〜3個、否定形（不適切なものを全て選べ）は無い（確認基準日: 2026-11-01）。
 * 本試験の受験サイトが複数の正解を持つ問題に対応していることは、JDLA「受験当日の操作マニュアル」Ver12R00の
 * チュートリアル（正解が3つあるサンプル問題）で確認した。
 */
export const answerTypeSchema = z.enum(["single", "multiple"]);

/**
 * 問題の区分。省略時は"chapter"（格納テキストの各章に基づく通常の問題）。
 * "term_check": 用語確認ドリル。格納テキストにないG検定シラバスのキーワードを補う
 * 補遺（materials/supplements/*.md）を出典とし、用語の説明の正誤や用語名を問う。
 * "calculation": 計算問題。補遺を出典とし、確率・統計やネットワークの計算を数値で答える。
 * どちらも補遺が出典で、公式テキスト本文との照合が一部未実施のため、模擬試験には出題しない
 * （章別ドリルと復習で使う）。2026-11-06 導入。
 */
export const questionCategorySchema = z.enum(["chapter", "term_check", "calculation"]);

export const SUPPLEMENT_SOURCE_PREFIX = "materials/supplements/";

export const MULTIPLE_MIN_CHOICES = 4;
export const MULTIPLE_MAX_CHOICES = 6;
export const MULTIPLE_MIN_CORRECT = 2;
export const MULTIPLE_MAX_CORRECT = 3;

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
    category: questionCategorySchema.optional(),
    questionForm: questionFormSchema.optional(),
    questionStyle: questionStyleSchema.optional(),
    answerType: answerTypeSchema.optional(),
    question: z.string().min(1),
    choices: z.array(z.string().min(1)).min(4).max(MULTIPLE_MAX_CHOICES),
    correctAnswer: z.number().int().min(0).max(3).optional(),
    correctAnswers: z.array(z.number().int().min(0)).optional(),
    explanation: z.string().min(1),
    choiceExplanations: z.array(z.string().min(1)).min(4).max(MULTIPLE_MAX_CHOICES),
    tags: questionTagsSchema,
    sourceFile: z.string().min(1),
    sourceHeading: z.string().min(1),
    sourceReference: z.string().min(1),
    contentVersion: z.string().min(1),
    asOfDate: z.string().min(1).optional(),
    createdAt: z.string().min(1),
    reviewStatus: reviewStatusSchema,
  })
  .strict()
  .superRefine((q, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    if (
      (q.category ?? "chapter") !== "chapter" &&
      !q.sourceFile.startsWith(SUPPLEMENT_SOURCE_PREFIX)
    ) {
      issue(`用語確認・計算問題は補遺（${SUPPLEMENT_SOURCE_PREFIX}）を出典にする`);
    }
    if (
      (q.category ?? "chapter") === "chapter" &&
      q.sourceFile.startsWith(SUPPLEMENT_SOURCE_PREFIX)
    ) {
      issue('補遺を出典にする問題はcategoryを"term_check"か"calculation"にする');
    }
    if (q.choiceExplanations.length !== q.choices.length) {
      issue("choiceExplanationsはchoicesと同じ数にする");
    }
    if ((q.answerType ?? "single") === "single") {
      if (q.choices.length !== 4) issue("1つを選ぶ問題の選択肢は4つにする");
      if (q.correctAnswer === undefined) issue("1つを選ぶ問題にはcorrectAnswerが必要");
      if (q.correctAnswers !== undefined) issue("1つを選ぶ問題にcorrectAnswersは使わない");
      return;
    }
    if (q.choices.length < MULTIPLE_MIN_CHOICES || q.choices.length > MULTIPLE_MAX_CHOICES) {
      issue(`全て選ぶ問題の選択肢は${MULTIPLE_MIN_CHOICES}〜${MULTIPLE_MAX_CHOICES}つにする`);
    }
    if (q.correctAnswer !== undefined) issue("全て選ぶ問題にcorrectAnswerは使わない");
    const answers = q.correctAnswers ?? [];
    if (answers.length < MULTIPLE_MIN_CORRECT || answers.length > MULTIPLE_MAX_CORRECT) {
      issue(`全て選ぶ問題の正解は${MULTIPLE_MIN_CORRECT}〜${MULTIPLE_MAX_CORRECT}個にする`);
    }
    if (new Set(answers).size !== answers.length) issue("correctAnswersに重複がある");
    if (answers.some((i) => i >= q.choices.length)) issue("correctAnswersが選択肢の範囲外");
    if (!/(全て|いくつでも)選べ/.test(q.question)) {
      issue("全て選ぶ問題の設問文には「全て選べ」または「いくつでも選べ」を含める");
    }
    if (q.questionForm === "negative") {
      issue("全て選ぶ問題は肯定形にする（公式テキストに否定形は無い）");
    }
  });

export type Difficulty = z.infer<typeof difficultySchema>;
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export type SkillTag = z.infer<typeof skillTagSchema>;
export type QuestionForm = z.infer<typeof questionFormSchema>;
export type QuestionStyle = z.infer<typeof questionStyleSchema>;
export type AnswerType = z.infer<typeof answerTypeSchema>;
export type QuestionCategory = z.infer<typeof questionCategorySchema>;
export type QuestionTags = z.infer<typeof questionTagsSchema>;
export type Question = z.infer<typeof questionSchema>;
