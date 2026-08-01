#!/usr/bin/env node
// 自動生成スクリプトではありません（人手管理・直接編集可）。
//
// materials/chapters/*.md と materials/G検定_学習テキスト_Rev0.md の内容を
// 突き合わせ、章別Markdownを正本候補とした差分の有無を機械的に検出する。
//
// 使い方:
//   node scripts/compare-materials.mjs            # 全章を突き合わせ
//   node scripts/compare-materials.mjs 04          # 指定ファイル番号のみ再検証
//
// 判定方法:
//   1. Rev0.md の "# " 見出し（トップレベル）で本文を分割する。
//   2. 各分割ブロックの先頭行（見出し）が一致する章別Markdownファイルを対応付ける。
//   3. 両者を比較し、末尾の空行差分を除いた内容差分の有無を報告する。

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CHAPTERS_DIR = join(ROOT, "materials", "chapters");
const FULLTEXT_PATH = join(ROOT, "materials", "G検定_学習テキスト_Rev0.md");

const targetArg = process.argv[2]; // 例: "04"

function splitFullTextIntoBlocks(fullText) {
  const lines = fullText.split("\n");
  const blocks = [];
  let currentStart = null;
  lines.forEach((line, idx) => {
    if (/^# /.test(line)) {
      if (currentStart !== null) {
        blocks.push(lines.slice(currentStart, idx));
      }
      currentStart = idx;
    }
  });
  if (currentStart !== null) {
    blocks.push(lines.slice(currentStart));
  }
  return blocks;
}

function normalize(lines) {
  // 末尾の空行のみを削除して比較する（先頭・中間の空行差は本文差分として検出する）
  const copy = [...lines];
  while (copy.length > 0 && copy[copy.length - 1].trim() === "") {
    copy.pop();
  }
  return copy;
}

function diffLines(a, b) {
  const diffs = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (a[i] !== b[i]) {
      diffs.push({ line: i + 1, fullText: a[i] ?? "(なし)", chapterFile: b[i] ?? "(なし)" });
    }
  }
  return diffs;
}

function main() {
  const fullText = readFileSync(FULLTEXT_PATH, "utf-8");
  const blocks = splitFullTextIntoBlocks(fullText);

  const chapterFiles = readdirSync(CHAPTERS_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();

  const targetFiles = targetArg
    ? chapterFiles.filter((f) => f.startsWith(targetArg))
    : chapterFiles;

  if (targetArg && targetFiles.length === 0) {
    console.error(`指定番号 "${targetArg}" に一致する章別Markdownが見つかりません。`);
    process.exit(1);
  }

  let mismatchCount = 0;
  let unmatchedHeadingCount = 0;

  for (const fileName of targetFiles) {
    const chapterPath = join(CHAPTERS_DIR, fileName);
    const chapterLines = readFileSync(chapterPath, "utf-8").split("\n");
    const heading = chapterLines[0];

    const block = blocks.find((b) => b[0] === heading);

    if (!block) {
      unmatchedHeadingCount++;
      console.log(
        `[見出し不一致] ${fileName}: 見出し "${heading}" に対応する全文版ブロックが見つかりません。`,
      );
      continue;
    }

    const diffs = diffLines(normalize(block), normalize(chapterLines));

    if (diffs.length === 0) {
      console.log(`[一致] ${fileName}`);
    } else {
      mismatchCount++;
      console.log(`[差分あり] ${fileName}: ${diffs.length}件`);
      diffs.slice(0, 10).forEach((d) => {
        console.log(`  行${d.line}: 全文版="${d.fullText}" / 章別="${d.chapterFile}"`);
      });
      if (diffs.length > 10) {
        console.log(`  ...ほか${diffs.length - 10}件`);
      }
    }
  }

  console.log("");
  console.log(
    `検証対象: ${targetFiles.length}ファイル / 差分あり: ${mismatchCount} / 見出し不一致: ${unmatchedHeadingCount}`,
  );

  if (mismatchCount > 0 || unmatchedHeadingCount > 0) {
    process.exitCode = 1;
  }
}

main();
