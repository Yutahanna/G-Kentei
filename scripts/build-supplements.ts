#!/usr/bin/env tsx
/**
 * materials/supplements/*_ORG.md（補遺）を、章のページの最後に表示するためのJSONへ変換するビルドスクリプト。
 *
 * 使い方:
 *   npm run build:supplements
 *
 * 生成物: content/supplements.json（自動生成物。直接編集しない）
 *
 * 各項目を表示する節は、次の順で決める。
 * 1. その項目を出典（sourceFile・sourceHeading）にする問題がある場合は、問題の sectionId。
 * 2. 問題がない項目は、scripts/data/supplement-placement.json の割り当て表。
 * どちらでも決まらない項目があるとき、問題と割り当て表が食い違うときは、エラーにする。
 */
import { globSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  supplementContentSchema,
  type SupplementContent,
  type SupplementEntry,
} from "../src/schemas/supplement.schema";
import { manifestSchema } from "../src/schemas/content.schema";
import { makeBlockId, parseSupplement } from "./lib/parse-supplement";

const ROOT_DIR = join(import.meta.dirname, "..");
const SUPPLEMENTS_DIR = "materials/supplements";
const PLACEMENT_PATH = join(ROOT_DIR, "scripts", "data", "supplement-placement.json");
const OUT_PATH = join(ROOT_DIR, "content", "supplements.json");

type PlacementValue = string | { exclude: string };
interface PlacementFile {
  files: string[];
  placements: Record<string, Record<string, PlacementValue>>;
}

interface QuestionLike {
  id: string;
  sectionId: string;
  sourceFile?: string;
  sourceHeading?: string;
}

/** 問題データから「補遺ファイル#見出し → sectionId の集合」を作る。 */
function collectQuestionSections(): Map<string, Map<string, string[]>> {
  const result = new Map<string, Map<string, string[]>>();
  for (const file of globSync("questions/**/*.json", { cwd: ROOT_DIR })) {
    const raw = JSON.parse(readFileSync(join(ROOT_DIR, file), "utf-8")) as unknown;
    const questions = (Array.isArray(raw) ? raw : []) as QuestionLike[];
    for (const q of questions) {
      if (!q.sourceFile?.startsWith(`${SUPPLEMENTS_DIR}/`) || !q.sourceHeading) continue;
      const key = `${q.sourceFile}#${q.sourceHeading}`;
      const bySection = result.get(key) ?? new Map<string, string[]>();
      bySection.set(q.sectionId, [...(bySection.get(q.sectionId) ?? []), q.id]);
      result.set(key, bySection);
    }
  }
  return result;
}

function main(): void {
  const placement = JSON.parse(readFileSync(PLACEMENT_PATH, "utf-8")) as PlacementFile;
  const manifest = manifestSchema.parse(
    JSON.parse(readFileSync(join(ROOT_DIR, "content", "manifest.json"), "utf-8")) as unknown,
  );
  const knownSections = new Set(manifest.chapters.flatMap((c) => c.sectionIds));
  const questionSections = collectQuestionSections();
  const errors: string[] = [];

  const content: SupplementContent = {
    generatedAt: new Date().toISOString(),
    sources: [],
    entries: [],
  };

  for (const fileName of placement.files) {
    const sourceFile = `${SUPPLEMENTS_DIR}/${fileName}`;
    const parsed = parseSupplement(readFileSync(join(ROOT_DIR, sourceFile), "utf-8"));
    content.sources.push({ sourceFile, title: parsed.title, contentHash: parsed.contentHash });

    const manual = placement.placements[fileName] ?? {};
    const usedManualKeys = new Set<string>();

    for (const block of parsed.blocks) {
      const fromQuestions = questionSections.get(`${sourceFile}#${block.heading}`);
      const manualValue = manual[block.key];
      if (manualValue !== undefined) usedManualKeys.add(block.key);
      const where = `${fileName}「${block.key}」`;

      let sectionId: string | undefined;
      if (fromQuestions) {
        const sections = [...fromQuestions.keys()];
        if (sections.length > 1) {
          errors.push(`${where}: 出典にする問題が複数の節にあります（${sections.join("、")}）`);
          continue;
        }
        sectionId = sections[0];
        if (manualValue !== undefined && manualValue !== sectionId) {
          errors.push(
            `${where}: 割り当て表（${JSON.stringify(manualValue)}）が問題の節（${sectionId}）と食い違います`,
          );
          continue;
        }
      } else if (typeof manualValue === "string") {
        sectionId = manualValue;
      } else if (manualValue && typeof manualValue === "object") {
        continue; // 表示しない項目
      } else {
        errors.push(`${where}: 表示する節が決まっていません（割り当て表に追加してください）`);
        continue;
      }

      if (!sectionId || !knownSections.has(sectionId)) {
        errors.push(`${where}: 節 ${String(sectionId)} が content/manifest.json にありません`);
        continue;
      }

      const entry: SupplementEntry = {
        blockId: makeBlockId(fileName, block.key),
        sourceFile,
        supplementTitle: parsed.title,
        kind: block.kind,
        heading: block.heading,
        title: block.title,
        groupTitle: block.groupTitle,
        ...(block.pageRef ? { pageRef: block.pageRef } : {}),
        sectionId,
        body: block.body,
        ...(parsed.asOfDate ? { asOfDate: parsed.asOfDate } : {}),
      };
      content.entries.push(entry);
    }

    for (const key of Object.keys(manual)) {
      if (!usedManualKeys.has(key)) {
        errors.push(`${fileName}「${key}」: 割り当て表にあるが、補遺に該当する見出しがありません`);
      }
    }
  }

  const ids = content.entries.map((e) => e.blockId);
  const duplicated = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicated.length > 0) errors.push(`blockId が重複しています: ${duplicated.join("、")}`);

  if (errors.length > 0) {
    console.error(`補遺の変換に失敗しました（${errors.length}件）`);
    for (const e of errors) console.error(`- ${e}`);
    process.exit(1);
  }

  supplementContentSchema.parse(content);
  const payload = {
    _generated: true,
    _generatedBy: "scripts/build-supplements.ts",
    _doNotEdit:
      "このファイルは自動生成物です。修正は materials/supplements/、scripts/data/supplement-placement.json または scripts/build-supplements.ts に対して行ってください。",
    ...content,
  };
  writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");

  const bySection = new Map<string, number>();
  for (const e of content.entries)
    bySection.set(e.sectionId, (bySection.get(e.sectionId) ?? 0) + 1);
  console.log(
    `生成: ${OUT_PATH}（補遺 ${content.sources.length}件、項目 ${content.entries.length}件）`,
  );
  for (const [s, n] of [...bySection.entries()].sort()) console.log(`  ${s}: ${n}件`);
}

main();
