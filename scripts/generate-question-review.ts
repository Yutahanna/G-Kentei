#!/usr/bin/env tsx
/**
 * 指定した章の問題データのレビュー用一覧（docs/{chapterId}-question-review.md）を生成するスクリプト。
 * 検査ロジックの実体は scripts/lib/question-quality-checks.ts を使用し、
 * validate-questions.ts と共有している（章ごとに個別実装しない）。
 * docs/phase0-design.md 10節（品質基準・章ごとのレビューサイクル）に対応する。
 *
 * 使い方:
 *   npm run review -- ch01              # 全問を詳細表示（第1章・第2章で使用）
 *   npm run review -- ch03 --focused    # 重点レビュー対象のみ詳細表示、他は簡易表示（第3章以降）
 *   npm run review:ch01                 # ch01専用のショートカット（詳細表示）
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "node:fs";
import {
  questionSchema,
  type Question,
  type Difficulty,
  type ReviewStatus,
} from "../src/schemas/question.schema";
import {
  buildConceptVocabulary,
  computeNearConceptRate,
  computeSectionDistribution,
  computeSkillTagDistribution,
  findContentTagOverlaps,
  findSimilarPairs,
  NEAR_CONCEPT_MIN_HITS,
  selectFocusQuestionIds,
  type NearConceptResult,
} from "./lib/question-quality-checks";

const ROOT_DIR = join(import.meta.dirname, "..");

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  basic: "基礎",
  standard: "標準",
  advanced: "応用",
};

const DIFFICULTY_ORDER: Difficulty[] = ["basic", "standard", "advanced"];

const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  draft: "draft（ドラフト・レビュー待ち）",
  approved: "approved（承認済み）",
  needs_revision: "needs_revision（要修正）",
};

function loadQuestionsForChapter(chapterId: string): Question[] {
  const chapterDir = join(ROOT_DIR, "questions", chapterId);
  const fileNames = readdirSync(chapterDir).filter((f) => f.endsWith(".json"));
  // basic → standard → advanced の順に並べる。それ以外のファイル名は末尾に追加する。
  fileNames.sort((a, b) => {
    const rank = (f: string) => {
      const idx = DIFFICULTY_ORDER.findIndex((d) => f.startsWith(d));
      return idx === -1 ? DIFFICULTY_ORDER.length : idx;
    };
    return rank(a) - rank(b);
  });

  return fileNames.flatMap((fileName) => {
    const raw = JSON.parse(readFileSync(join(chapterDir, fileName), "utf-8")) as unknown[];
    return raw.map((item) => questionSchema.parse(item));
  });
}

/** 近接概念語彙を構築するため、全章の問題データを読み込む（他章の概念を使った誤答も検出するため）。 */
function loadAllQuestionsAcrossChapters(): Question[] {
  const files = globSync("questions/**/*.json", { cwd: ROOT_DIR });
  return files.flatMap((relPath) => {
    const raw = JSON.parse(readFileSync(join(ROOT_DIR, relPath), "utf-8")) as unknown[];
    return raw.map((item) => questionSchema.parse(item));
  });
}

function renderDistributionTables(questions: Question[]): string[] {
  const lines: string[] = [];
  lines.push("## 節別・出題意図別の分布");
  lines.push("");
  lines.push(
    "節ごとの問題数が特定の節に偏っていないか、また基礎難易度が暗記偏重になっていないかを確認するための集計。",
  );
  lines.push("");
  lines.push("| 節 | 基礎 | 標準 | 応用 | 合計 |");
  lines.push("|---|---|---|---|---|");
  for (const row of computeSectionDistribution(questions)) {
    lines.push(`| ${row.key} | ${row.basic} | ${row.standard} | ${row.advanced} | ${row.total} |`);
  }
  lines.push("");
  lines.push(
    "※ 1問に複数の`skillTags`を付与できるため、下表の件数合計は問題総数を超える場合がある。",
  );
  lines.push("");
  lines.push("| 出題意図（skillTag） | 基礎 | 標準 | 応用 | 合計 |");
  lines.push("|---|---|---|---|---|");
  for (const row of computeSkillTagDistribution(questions)) {
    lines.push(`| ${row.key} | ${row.basic} | ${row.standard} | ${row.advanced} | ${row.total} |`);
  }
  lines.push("");
  return lines;
}

function renderQuestionDetail(q: Question, index: number): string[] {
  const lines: string[] = [];
  lines.push(`### ${index + 1}. [${q.id}] （${DIFFICULTY_LABEL[q.difficulty]}）`);
  lines.push("");
  lines.push(`**問題文**：${q.question}`);
  lines.push("");
  lines.push("**選択肢**：");
  q.choices.forEach((choice, i) => {
    const marker = i === q.correctAnswer ? "◯ 正解" : "✕";
    lines.push(`${i + 1}. ${choice} — **${marker}**`);
  });
  lines.push("");
  lines.push(`**正答の解説**：${q.explanation}`);
  lines.push("");
  lines.push("**各選択肢の説明**：");
  q.choiceExplanations.forEach((exp, i) => {
    lines.push(`- 選択肢${i + 1}：${exp}`);
  });
  lines.push("");
  lines.push(`**タグ（表示用・概念）**：${q.tags.contentTags.join(" / ")}`);
  lines.push("");
  lines.push(
    `**タグ（内部管理用・出題意図）**：${q.tags.skillTags.join(" / ")}` +
      (q.tags.crossChapterTags.length > 0
        ? ` ／ 章横断：${q.tags.crossChapterTags.join(" / ")}`
        : ""),
  );
  lines.push("");
  lines.push(
    `**教材参照**：${q.sourceReference}（見出し: 「${q.sourceHeading}」／${q.sourceFile}）`,
  );
  lines.push("");
  lines.push(`**レビュー状態**：${REVIEW_STATUS_LABEL[q.reviewStatus]}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  return lines;
}

function main(): void {
  const chapterId = process.argv[2] ?? "ch01";
  const focusedMode = process.argv.includes("--focused");
  const questions = loadQuestionsForChapter(chapterId);

  const similarPairs = findSimilarPairs(questions);
  const tagOverlaps = findContentTagOverlaps(questions);
  const vocabulary = buildConceptVocabulary(loadAllQuestionsAcrossChapters());
  const nearConceptResults: NearConceptResult[] = questions.map((q) =>
    computeNearConceptRate(q, vocabulary),
  );
  const lowNearConceptResults = nearConceptResults.filter(
    (r) => r.nearConceptHits < NEAR_CONCEPT_MIN_HITS,
  );

  const focusIds = focusedMode
    ? selectFocusQuestionIds({ questions, similarPairs, tagOverlaps, nearConceptResults })
    : new Set(questions.map((q) => q.id));

  const lines: string[] = [];
  lines.push(`# ${chapterId} 問題データ レビュー用一覧`);
  lines.push("");
  lines.push(
    `このファイルは \`npm run review -- ${chapterId}${focusedMode ? " --focused" : ""}\` が自動生成します。直接編集せず、修正は \`questions/${chapterId}/*.json\` に対して行ってください。`,
  );
  lines.push("");
  lines.push(`生成日時: ${new Date().toISOString()}`);
  lines.push("");
  lines.push(
    `合計 ${questions.length} 問（基礎 ${questions.filter((q) => q.difficulty === "basic").length} 問／標準 ${questions.filter((q) => q.difficulty === "standard").length} 問／応用 ${questions.filter((q) => q.difficulty === "advanced").length} 問）`,
  );
  if (focusedMode) {
    lines.push("");
    lines.push(
      `重点レビュー方式: 基礎2問・標準3問・応用3問の代表サンプル、自動検査で警告が出た全問題、章横断タグを持つ全問題を詳細表示し、それ以外は簡易表示とする（今回の詳細表示: ${focusIds.size}問）。`,
    );
  }
  lines.push("");
  lines.push(...renderDistributionTables(questions));

  lines.push("## 重複・類似問題チェック");
  lines.push("");
  lines.push("### 表現レベルの類似度（問題文＋選択肢のトークン類似度0.8以上）");
  lines.push("");
  if (similarPairs.length === 0) {
    lines.push("該当するペアは検出されませんでした。");
  } else {
    lines.push("以下のペアで高い類似度が検出されました。内容を確認してください。");
    lines.push("");
    similarPairs.forEach((p) =>
      lines.push(`- ${p.aId} と ${p.bId}（類似度${p.similarity.toFixed(2)}）`),
    );
  }
  lines.push("");
  lines.push(
    "### 論点レベルの重複（同一節・contentTags完全一致。表現を変えただけの水増しがないかの確認用）",
  );
  lines.push("");
  if (tagOverlaps.length === 0) {
    lines.push("該当する組は検出されませんでした。");
  } else {
    lines.push(
      "以下の組はcontentTagsが完全に一致しています。同一論点の言い換えでないか確認してください（同一概念を難易度違いで扱う意図的な設計の場合は問題ない）。",
    );
    lines.push("");
    tagOverlaps.forEach((g) =>
      lines.push(`- ${g.ids.join(" / ")}（contentTags完全一致: ${g.contentTagKey}）`),
    );
  }
  lines.push("");
  lines.push("### 誤答選択肢の近接概念チェック");
  lines.push("");
  lines.push(
    "誤答選択肢が教材内の他の概念（contentTagsの語彙）に言及しているかどうかの機械的な近似チェック。語の一致に基づく粗い判定のため、見落とし・誤検出がありうる。",
  );
  lines.push("");
  if (lowNearConceptResults.length === 0) {
    lines.push("基準を下回る問題は検出されませんでした。");
  } else {
    lines.push(
      `以下の問題は、誤答選択肢のうち教材内の近接概念を含むものが基準(${NEAR_CONCEPT_MIN_HITS}件)を下回っています。`,
    );
    lines.push("");
    lowNearConceptResults.forEach((r) =>
      lines.push(
        `- ${r.questionId}（近接概念を含む誤答: ${r.nearConceptHits}/${r.wrongChoiceCount}件、選択肢${r.flaggedChoiceIndexes.map((i) => i + 1).join("/")}が該当）`,
      ),
    );
  }
  lines.push("");

  lines.push("## 問題一覧");
  lines.push("");

  if (focusedMode) {
    const focusQuestions = questions.filter((q) => focusIds.has(q.id));
    const restQuestions = questions.filter((q) => !focusIds.has(q.id));

    lines.push("### 重点レビュー対象（詳細表示）");
    lines.push("");
    focusQuestions.forEach((q, i) => lines.push(...renderQuestionDetail(q, i)));

    lines.push("### その他（簡易表示・自動検査で警告なし）");
    lines.push("");
    if (restQuestions.length === 0) {
      lines.push("該当なし（全問が重点レビュー対象）。");
    } else {
      lines.push("| ID | 難易度 | 問題文 | 正解 | タグ（表示用） |");
      lines.push("|---|---|---|---|---|");
      restQuestions.forEach((q) => {
        lines.push(
          `| ${q.id} | ${DIFFICULTY_LABEL[q.difficulty]} | ${q.question} | ${q.choices[q.correctAnswer]} | ${q.tags.contentTags.join(" / ")} |`,
        );
      });
    }
    lines.push("");
  } else {
    questions.forEach((q, index) => lines.push(...renderQuestionDetail(q, index)));
  }

  const outPath = join(ROOT_DIR, "docs", `${chapterId}-question-review.md`);
  writeFileSync(outPath, `${lines.join("\n")}\n`, "utf-8");
  console.log(
    `生成: ${outPath}（${questions.length}問、詳細表示${focusIds.size}問${focusedMode ? "・重点レビューモード" : ""}）`,
  );
  if (similarPairs.length > 0) {
    console.log(`表現レベルの類似問題の疑いが${similarPairs.length}件あります。`);
  }
  if (tagOverlaps.length > 0) {
    console.log(`論点レベルの重複の疑いが${tagOverlaps.length}件あります。`);
  }
  if (lowNearConceptResults.length > 0) {
    console.log(`近接概念の基準を下回る問題が${lowNearConceptResults.length}件あります。`);
  }
}

main();
