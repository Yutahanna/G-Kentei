#!/usr/bin/env tsx
/**
 * materials/chapters/*.md（正本）を構造化JSONへ変換するビルドスクリプト。
 *
 * 使い方:
 *   npm run build:content          # フェーズ1: 第1章のみ変換
 *   npm run build:content -- 03    # 章番号を指定して変換（例: 第3章）
 *
 * 生成物: content/chapters/ch{NN}.json, content/manifest.json
 * 生成物は自動生成物であり、直接編集しない（修正はmaterials/またはこのスクリプトに対して行う）。
 *
 * パース処理本体は scripts/lib/parse-chapter.ts にあり、tests/unit/parse-chapter.test.ts で
 * 回帰テストしている。docs/phase0-design.md 3.2節のビルドパイプライン方針に対応する。
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  chapterSchema,
  manifestSchema,
  type Chapter,
  type Manifest,
} from "../src/schemas/content.schema";
import { CHAPTER_FILES, parseChapter } from "./lib/parse-chapter";

const ROOT_DIR = join(import.meta.dirname, "..");
const MATERIALS_DIR = join(ROOT_DIR, "materials", "chapters");
const CONTENT_DIR = join(ROOT_DIR, "content");

function buildChapter(chapterNumber: number): Chapter {
  const fileName = CHAPTER_FILES[chapterNumber];
  if (!fileName) {
    throw new Error(`章番号 ${chapterNumber} に対応する教材ファイルが未登録です`);
  }
  const markdown = readFileSync(join(MATERIALS_DIR, fileName), "utf-8");
  const chapter = parseChapter(chapterNumber, markdown);
  return chapterSchema.parse(chapter);
}

function writeGeneratedJson(filePath: string, data: unknown): void {
  const payload = {
    _generated: true,
    _generatedBy: "scripts/build-content.ts",
    _doNotEdit:
      "このファイルは自動生成物です。修正は materials/ または scripts/build-content.ts に対して行ってください。",
    ...(data as Record<string, unknown>),
  };
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
}

function main(): void {
  const arg = process.argv[2];
  const chapterNumbers = arg ? [Number.parseInt(arg, 10)] : [1];

  mkdirSync(join(CONTENT_DIR, "chapters"), { recursive: true });

  const manifestPath = join(CONTENT_DIR, "manifest.json");
  const existingManifest: Manifest = existsSync(manifestPath)
    ? manifestSchema.parse(JSON.parse(readFileSync(manifestPath, "utf-8")) as unknown)
    : { generatedAt: new Date().toISOString(), chapters: [] };

  const manifestChapters = new Map(existingManifest.chapters.map((c) => [c.chapterId, c]));

  for (const chapterNumber of chapterNumbers) {
    const chapter = buildChapter(chapterNumber);
    const outPath = join(CONTENT_DIR, "chapters", `${chapter.chapterId}.json`);
    writeGeneratedJson(outPath, chapter);

    manifestChapters.set(chapter.chapterId, {
      chapterId: chapter.chapterId,
      title: chapter.title,
      sourceFile: chapter.sourceFile,
      contentHash: chapter.contentHash,
      sectionIds: chapter.sections.map((s) => s.sectionId),
    });

    console.log(`生成: ${outPath}（節数: ${chapter.sections.length}）`);
  }

  const manifest: Manifest = {
    generatedAt: new Date().toISOString(),
    chapters: [...manifestChapters.values()].sort((a, b) => a.chapterId.localeCompare(b.chapterId)),
  };
  manifestSchema.parse(manifest);
  writeGeneratedJson(manifestPath, manifest);
  console.log(`生成: ${manifestPath}`);
}

main();
