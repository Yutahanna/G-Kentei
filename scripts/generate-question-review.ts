#!/usr/bin/env tsx
/**
 * 第1章25問のレビュー用一覧（docs/ch01-question-review.md）を生成するスクリプト。
 * 問題文・選択肢・正答・解説・全選択肢の説明・難易度・タグ・教材参照先を
 * 通読できる形で一覧化する。docs/phase0-design.md 11節のフェーズ1受入基準に対応する。
 *
 * 使い方: npm run review:ch01
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  questionSchema,
  type Question,
  type Difficulty,
  type ReviewStatus,
} from "../src/schemas/question.schema";

const ROOT_DIR = join(import.meta.dirname, "..");
const OUT_PATH = join(ROOT_DIR, "docs", "ch01-question-review.md");

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  basic: "基礎",
  standard: "標準",
  advanced: "応用",
};

const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  draft: "draft（ドラフト・レビュー待ち）",
  approved: "approved（承認済み）",
  needs_revision: "needs_revision（要修正）",
};

function loadQuestions(fileName: string): Question[] {
  const raw = JSON.parse(
    readFileSync(join(ROOT_DIR, "questions", "ch01", fileName), "utf-8"),
  ) as unknown[];
  return raw.map((item) => questionSchema.parse(item));
}

/** 正規化した問題文＋選択肢のトークン集合が高い類似度を持つ組を検出する（重複確認用）。 */
function tokenize(text: string): Set<string> {
  const normalized = text.replace(/[「」『』（）()、。・\s]/g, "");
  const tokens = new Set<string>();
  for (let i = 0; i < normalized.length - 1; i++) {
    tokens.add(normalized.slice(i, i + 2));
  }
  return tokens;
}
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function main(): void {
  const questions = [
    ...loadQuestions("basic.json"),
    ...loadQuestions("standard.json"),
    ...loadQuestions("advanced.json"),
  ];

  const duplicateWarnings: string[] = [];
  for (let i = 0; i < questions.length; i++) {
    const qi = questions[i]!;
    const ti = tokenize(qi.question + qi.choices.join(""));
    for (let j = i + 1; j < questions.length; j++) {
      const qj = questions[j]!;
      const tj = tokenize(qj.question + qj.choices.join(""));
      const sim = jaccardSimilarity(ti, tj);
      if (sim >= 0.8) {
        duplicateWarnings.push(`${qi.id} と ${qj.id}（類似度${sim.toFixed(2)}）`);
      }
    }
  }

  const lines: string[] = [];
  lines.push("# 第1章25問 レビュー用一覧");
  lines.push("");
  lines.push(
    "このファイルは `npm run review:ch01` が自動生成します。直接編集せず、修正は `questions/ch01/*.json` に対して行ってください。",
  );
  lines.push("");
  lines.push(`生成日時: ${new Date().toISOString()}`);
  lines.push("");
  lines.push(
    `合計 ${questions.length} 問（基礎 ${questions.filter((q) => q.difficulty === "basic").length} 問／標準 ${questions.filter((q) => q.difficulty === "standard").length} 問／応用 ${questions.filter((q) => q.difficulty === "advanced").length} 問）`,
  );
  lines.push("");
  lines.push("## 節別・出題意図別の分布");
  lines.push("");
  lines.push(
    "節ごとの問題数が特定の節に偏っていないか、また基礎難易度が暗記偏重になっていないかを確認するための集計。",
  );
  lines.push("");
  const sectionIds = Array.from(new Set(questions.map((q) => q.sectionId))).sort();
  lines.push("| 節 | 基礎 | 標準 | 応用 | 合計 |");
  lines.push("|---|---|---|---|---|");
  for (const sectionId of sectionIds) {
    const inSection = questions.filter((q) => q.sectionId === sectionId);
    const basic = inSection.filter((q) => q.difficulty === "basic").length;
    const standard = inSection.filter((q) => q.difficulty === "standard").length;
    const advanced = inSection.filter((q) => q.difficulty === "advanced").length;
    lines.push(`| ${sectionId} | ${basic} | ${standard} | ${advanced} | ${inSection.length} |`);
  }
  lines.push("");
  const skillTagValues = ["暗記", "比較", "関係性", "適用判断"] as const;
  lines.push("| 出題意図（skillTag） | 基礎 | 標準 | 応用 | 合計 |");
  lines.push("|---|---|---|---|---|");
  for (const skill of skillTagValues) {
    const withSkill = questions.filter((q) => q.tags.skillTags.includes(skill));
    const basic = withSkill.filter((q) => q.difficulty === "basic").length;
    const standard = withSkill.filter((q) => q.difficulty === "standard").length;
    const advanced = withSkill.filter((q) => q.difficulty === "advanced").length;
    lines.push(`| ${skill} | ${basic} | ${standard} | ${advanced} | ${withSkill.length} |`);
  }
  lines.push("");
  lines.push("## 重複・類似問題チェック");
  lines.push("");
  if (duplicateWarnings.length === 0) {
    lines.push("類似度0.8以上のペアは検出されませんでした。");
  } else {
    lines.push("以下のペアで高い類似度が検出されました。内容を確認してください。");
    lines.push("");
    duplicateWarnings.forEach((w) => lines.push(`- ${w}`));
  }
  lines.push("");
  lines.push("## 問題一覧");
  lines.push("");

  questions.forEach((q, index) => {
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
  });

  writeFileSync(OUT_PATH, `${lines.join("\n")}\n`, "utf-8");
  console.log(`生成: ${OUT_PATH}（${questions.length}問）`);
  if (duplicateWarnings.length > 0) {
    console.log(`類似問題の疑いが${duplicateWarnings.length}件あります。内容を確認してください。`);
  }
}

main();
