#!/usr/bin/env tsx
/**
 * questions/**\/*.json の品質検査スクリプト。
 * docs/phase0-design.md 10節の自動検査項目に対応する。
 * 検査ロジックの実体は scripts/lib/question-quality-checks.ts にあり、
 * generate-question-review.ts と共有している（章ごとに個別実装しない）。
 *
 * 使い方: npm run validate:questions
 * 終了コード: エラーが1件でもあれば非0で終了する（警告のみの場合は0で終了）。
 */
import { globSync } from "node:fs";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { questionSchema, type Question } from "../src/schemas/question.schema";
import { manifestSchema, type Manifest } from "../src/schemas/content.schema";
import {
  buildConceptVocabulary,
  checkQuestionCountsAgainstDesign,
  computeAnswerPositionDistribution,
  computeNearConceptRate,
  computeQuestionFormDistribution,
  computeSectionDistribution,
  computeSkillTagDistribution,
  findAbsoluteQualifierConcentration,
  findAnswerPositionSkewWarning,
  findChoiceLengthImbalances,
  findContentTagOverlaps,
  findExtremePhraseUsages,
  findSimilarPairs,
  hasCaseApplicationInAdvanced,
  NEAR_CONCEPT_MIN_HITS,
} from "./lib/question-quality-checks";

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

  // 難易度別・章別の問題数分布（章ごとに検査するため、章IDでグルーピングする）
  const questionsByChapter = new Map<string, Question[]>();
  for (const { question } of allQuestions) {
    const arr = questionsByChapter.get(question.chapterId) ?? [];
    arr.push(question);
    questionsByChapter.set(question.chapterId, arr);
  }

  const countByChapterAndDifficulty = new Map<string, number>();
  for (const { question } of allQuestions) {
    const key = `${question.chapterId}:${question.difficulty}`;
    countByChapterAndDifficulty.set(key, (countByChapterAndDifficulty.get(key) ?? 0) + 1);
  }

  // 近接概念の語彙は全章横断で構築する（他章の概念を使った紛らわしい誤答も正しく検出するため）。
  const globalVocabulary = buildConceptVocabulary(allQuestions.map((q) => q.question));

  // 章ごとに: 類似問題検出、論点重複検出、近接概念の割合検査
  for (const [chapterId, chapterQuestions] of questionsByChapter) {
    const similarPairs = findSimilarPairs(chapterQuestions);
    for (const pair of similarPairs) {
      warn(`類似問題の疑い (類似度${pair.similarity.toFixed(2)}): "${pair.aId}" と "${pair.bId}"`);
    }

    const tagOverlaps = findContentTagOverlaps(chapterQuestions);
    for (const group of tagOverlaps) {
      warn(
        `論点重複の疑い（同一節・contentTags完全一致: ${group.contentTagKey}）: ${group.ids.join(", ")}。同一概念を難易度違いで扱う意図的な設計の場合は問題ない。`,
      );
    }

    const vocabulary = globalVocabulary;
    let totalWrong = 0;
    let totalNearConceptHits = 0;
    for (const q of chapterQuestions) {
      const result = computeNearConceptRate(q, vocabulary);
      totalWrong += result.wrongChoiceCount;
      totalNearConceptHits += result.nearConceptHits;
      if (result.nearConceptHits < NEAR_CONCEPT_MIN_HITS) {
        warn(
          `[${chapterId}] [${q.id}]: 誤答選択肢のうち教材内の近接概念を含むものが${result.nearConceptHits}件（誤答${result.wrongChoiceCount}件中）で、基準の${NEAR_CONCEPT_MIN_HITS}件を下回っています。選択肢${result.flaggedChoiceIndexes.map((i) => i + 1).join("/")}が該当します（見落としの可能性もあるため要確認）。`,
        );
      }
    }
    const chapterRate = totalWrong === 0 ? 1 : totalNearConceptHits / totalWrong;
    console.log(
      `[${chapterId}] 近接概念を含む誤答選択肢の割合: ${(chapterRate * 100).toFixed(0)}%（${totalNearConceptHits}/${totalWrong}）`,
    );

    const countCheck = checkQuestionCountsAgainstDesign(chapterQuestions);
    if (!countCheck.totalMatches) {
      warn(
        `[${chapterId}]: 総問題数が設計値と一致しません（設計値25問 / 実際${countCheck.actualTotal}問）。`,
      );
    }
    for (const mismatch of countCheck.mismatchedDifficulties) {
      warn(
        `[${chapterId}]: ${mismatch.difficulty}の問題数が設計値と一致しません（設計値${mismatch.expected}問 / 実際${mismatch.actual}問）。`,
      );
    }

    const skewWarning = findAnswerPositionSkewWarning(chapterQuestions);
    if (skewWarning) {
      warn(`[${chapterId}] 正答位置の偏り: ${skewWarning}`);
    }
    const { countByIndex } = computeAnswerPositionDistribution(chapterQuestions);
    console.log(
      `[${chapterId}] 正答位置別件数: 選択肢1=${countByIndex[0]} / 選択肢2=${countByIndex[1]} / 選択肢3=${countByIndex[2]} / 選択肢4=${countByIndex[3]}`,
    );

    if (!hasCaseApplicationInAdvanced(chapterQuestions)) {
      warn(
        `[${chapterId}]: 応用問題に事例適用型（skillTagsに"適用判断"を含む問題）が1問も含まれていません。`,
      );
    }

    for (const result of findExtremePhraseUsages(chapterQuestions)) {
      warn(
        `[${chapterId}] [${result.questionId}]: 誤答選択肢${result.matchedChoiceIndexes.map((i) => i + 1).join("/")}に極端な断定表現が含まれています。近接概念を用いた誤答に差し替えられないか確認してください。`,
      );
    }

    for (const imbalance of findChoiceLengthImbalances(chapterQuestions)) {
      warn(
        `[${chapterId}] [${imbalance.questionId}]: 正答の文字数(${imbalance.correctLength})が最長の誤答(${imbalance.longestWrongLength})の${imbalance.ratio.toFixed(1)}倍あり、正答だけが極端に長い可能性があります。`,
      );
    }

    for (const result of findAbsoluteQualifierConcentration(chapterQuestions)) {
      warn(
        `[${chapterId}] [${result.questionId}]: 誤答選択肢${result.wrongChoiceCount}件すべてに「すべて/常に/のみ/必ず/一切/絶対/唯一/完全に/決して」等の断定的な表現が含まれており、内容を読まず断定表現だけで消去できてしまう可能性があります。`,
      );
    }

    const formDistribution = computeQuestionFormDistribution(chapterQuestions);
    console.log(
      `[${chapterId}] 設問形式別件数: 肯定形=${formDistribution.affirmative} / 否定形=${formDistribution.negative}`,
    );
  }

  // レポート出力（章・節×問題数の対応表、節別・skillTags別分布を含む）
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
  reportLines.push("", `総問題数: ${allQuestions.length}`, "");
  reportLines.push("## 章別・skillTags別分布");
  reportLines.push("");
  reportLines.push(
    "※ 1問に複数のskillTagsを付与できるため、件数合計は章の問題総数を超える場合がある。",
  );
  reportLines.push("");
  for (const [chapterId, chapterQuestions] of questionsByChapter) {
    reportLines.push(`### ${chapterId}`);
    reportLines.push("");
    reportLines.push("| skillTag | 基礎 | 標準 | 応用 | 合計 |");
    reportLines.push("|---|---|---|---|---|");
    for (const row of computeSkillTagDistribution(chapterQuestions)) {
      reportLines.push(
        `| ${row.key} | ${row.basic} | ${row.standard} | ${row.advanced} | ${row.total} |`,
      );
    }
    reportLines.push("");
  }
  writeFileSync(REPORT_PATH, `${reportLines.join("\n")}\n`, "utf-8");

  // 分布は章ごとの内訳としてコンソールにも出す（節別）
  for (const [chapterId, chapterQuestions] of questionsByChapter) {
    const skewed = computeSectionDistribution(chapterQuestions).filter(
      (row) => row.total === 0 || row.basic + row.standard + row.advanced === 0,
    );
    if (skewed.length > 0) {
      warn(`[${chapterId}]: 問題が0件の節があります: ${skewed.map((r) => r.key).join(", ")}`);
    }
  }

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
