#!/usr/bin/env tsx
/**
 * questions/**\/*.json の品質検査スクリプト。
 * docs/phase0-design.md 10節の自動検査項目に対応する。
 *
 * 使い方: npm run validate:questions
 * 終了コード: エラーが1件でもあれば非0で終了する（警告のみの場合は0で終了）。
 */
import { globSync } from "node:fs";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { questionSchema, type Question } from "../src/schemas/question.schema";
import { manifestSchema, type Manifest } from "../src/schemas/content.schema";

const ROOT_DIR = join(import.meta.dirname, "..");
const MANIFEST_PATH = join(ROOT_DIR, "content", "manifest.json");
const REPORT_PATH = join(ROOT_DIR, "docs", "content-mapping.md");

interface Issue {
  level: "error" | "warning";
  message: string;
}

const issues: Issue[] = [];
function error(message: string): void {
  issues.push({ level: "error", message });
}
function warn(message: string): void {
  issues.push({ level: "warning", message });
}

function loadManifest(): Manifest | null {
  if (!existsSync(MANIFEST_PATH)) {
    return null;
  }
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8")) as unknown;
  return manifestSchema.parse(raw);
}

function loadAllQuestions(): { file: string; raw: unknown }[] {
  const files = globSync("questions/**/*.json", { cwd: ROOT_DIR }).sort();
  return files.map((relPath) => ({
    file: relPath,
    raw: JSON.parse(readFileSync(join(ROOT_DIR, relPath), "utf-8")) as unknown,
  }));
}

/** 問題文＋選択肢を正規化したトークン集合のJaccard類似度で重複・類似問題を検出する。 */
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
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const SIMILARITY_THRESHOLD = 0.8;

function main(): void {
  const manifest = loadManifest();
  if (!manifest) {
    warn(
      `content/manifest.json が見つかりません。sourceReference の実在チェックをスキップします。先に "npm run build:content" を実行してください。`,
    );
  }
  const sectionIdSet = new Set(manifest?.chapters.flatMap((c) => c.sectionIds) ?? []);
  const chapterIdSet = new Set(manifest?.chapters.map((c) => c.chapterId) ?? []);
  const chapterHashById = new Map(
    manifest?.chapters.map((c) => [c.chapterId, c.contentHash]) ?? [],
  );

  const files = loadAllQuestions();
  if (files.length === 0) {
    error("questions/ 配下に問題データが見つかりません。");
  }

  const allQuestions: { file: string; question: Question }[] = [];
  const idOccurrences = new Map<string, string[]>();

  for (const { file, raw } of files) {
    if (!Array.isArray(raw)) {
      error(`${file}: 配列（Question[]）ではありません。`);
      continue;
    }
    raw.forEach((item, index) => {
      const result = questionSchema.safeParse(item);
      if (!result.success) {
        for (const issue of result.error.issues) {
          error(
            `${file}[${index}]: スキーマ検証エラー (${issue.path.join(".")}): ${issue.message}`,
          );
        }
        return;
      }
      const question = result.data;
      allQuestions.push({ file, question });

      const occurrences = idOccurrences.get(question.id) ?? [];
      occurrences.push(file);
      idOccurrences.set(question.id, occurrences);

      if (manifest && !chapterIdSet.has(question.chapterId)) {
        error(
          `${file} [${question.id}]: chapterId "${question.chapterId}" が content/manifest.json に存在しません。`,
        );
      }
      if (manifest && !sectionIdSet.has(question.sectionId)) {
        error(
          `${file} [${question.id}]: sectionId "${question.sectionId}" が content/manifest.json に存在しません。`,
        );
      }
      if (manifest) {
        const expectedHash = chapterHashById.get(question.chapterId);
        if (expectedHash && expectedHash !== question.contentVersion) {
          warn(
            `${file} [${question.id}]: contentVersion が教材の現在のcontentHashと一致しません（教材が改訂された可能性があります。再レビューを検討してください）。`,
          );
        }
      }
    });
  }

  for (const [id, occurrences] of idOccurrences) {
    if (occurrences.length > 1) {
      error(
        `問題ID重複: "${id}" が ${occurrences.length} 件見つかりました（${occurrences.join(", ")}）。`,
      );
    }
  }

  // 難易度別・章別の問題数分布
  const countByChapterAndDifficulty = new Map<string, number>();
  for (const { question } of allQuestions) {
    const key = `${question.chapterId}:${question.difficulty}`;
    countByChapterAndDifficulty.set(key, (countByChapterAndDifficulty.get(key) ?? 0) + 1);
  }

  // 章・節ごとの問題数（レポート用）
  const countBySection = new Map<string, number>();
  for (const { question } of allQuestions) {
    countBySection.set(question.sectionId, (countBySection.get(question.sectionId) ?? 0) + 1);
  }

  // 類似問題検出
  for (let i = 0; i < allQuestions.length; i++) {
    const qi = allQuestions[i];
    if (!qi) continue;
    const textI = tokenize(qi.question.question + qi.question.choices.join(""));
    for (let j = i + 1; j < allQuestions.length; j++) {
      const qj = allQuestions[j];
      if (!qj) continue;
      const textJ = tokenize(qj.question.question + qj.question.choices.join(""));
      const similarity = jaccardSimilarity(textI, textJ);
      if (similarity >= SIMILARITY_THRESHOLD) {
        warn(
          `類似問題の疑い (類似度${similarity.toFixed(2)}): "${qi.question.id}" と "${qj.question.id}"`,
        );
      }
    }
  }

  // レポート出力（章・節×問題数の対応表）
  const manifestChapters = manifest?.chapters ?? [];
  const reportLines: string[] = [
    "# 章・節×問題データ 対応表（自動生成）",
    "",
    "このファイルは `npm run validate:questions` が自動生成します。直接編集しないでください。",
    "",
    `生成日時: ${new Date().toISOString()}`,
    "",
    "| 章 | 節 | 基礎 | 標準 | 応用 | 合計 |",
    "|---|---|---|---|---|---|",
  ];
  for (const chapter of manifestChapters) {
    for (const sectionId of chapter.sectionIds) {
      const sectionQuestions = allQuestions.filter((q) => q.question.sectionId === sectionId);
      const basic = sectionQuestions.filter((q) => q.question.difficulty === "basic").length;
      const standard = sectionQuestions.filter((q) => q.question.difficulty === "standard").length;
      const advanced = sectionQuestions.filter((q) => q.question.difficulty === "advanced").length;
      reportLines.push(
        `| ${chapter.title} | ${sectionId} | ${basic} | ${standard} | ${advanced} | ${sectionQuestions.length} |`,
      );
    }
  }
  reportLines.push("", `総問題数: ${allQuestions.length}`);
  writeFileSync(REPORT_PATH, `${reportLines.join("\n")}\n`, "utf-8");

  // 出力
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");

  console.log(`検証対象: ${allQuestions.length}問（${files.length}ファイル）`);
  console.log("");
  if (warnings.length > 0) {
    console.log(`警告 ${warnings.length}件:`);
    warnings.forEach((w) => console.log(`  [WARN] ${w.message}`));
    console.log("");
  }
  if (errors.length > 0) {
    console.log(`エラー ${errors.length}件:`);
    errors.forEach((e) => console.log(`  [ERROR] ${e.message}`));
    console.log("");
  }

  console.log(
    `章別・難易度別分布: ${JSON.stringify(Object.fromEntries(countByChapterAndDifficulty))}`,
  );
  console.log(`レポート出力: ${REPORT_PATH}`);

  if (errors.length > 0) {
    console.log(`\n検証失敗: エラー${errors.length}件`);
    process.exitCode = 1;
  } else {
    console.log(`\n検証成功: エラー0件（警告${warnings.length}件）`);
  }
}

main();
