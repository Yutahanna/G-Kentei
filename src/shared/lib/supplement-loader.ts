import supplementsRaw from "../../../content/supplements.json";
import { supplementContentSchema, type SupplementEntry } from "../../schemas/supplement.schema";

/**
 * content/supplements.json（補遺を変換した生成物）を読み込む唯一の入り口。
 * 補遺は格納テキストとは別の資料なので、章本文（content-loader.ts）とは分けて扱う。
 */

const content = supplementContentSchema.parse(supplementsRaw);

const bySourceKey = new Map<string, SupplementEntry>(
  content.entries.map((e) => [`${e.sourceFile}#${e.heading}`, e]),
);

/** 章に割り当てた補遺の項目を、節の順・補遺の中の順に返す。 */
export function getChapterSupplements(chapterId: string): SupplementEntry[] {
  return content.entries
    .filter((e) => e.sectionId.startsWith(`${chapterId}-`))
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.sectionId.localeCompare(b.e.sectionId) || a.i - b.i)
    .map(({ e }) => e);
}

/** 問題の出典（sourceFile・sourceHeading）に当たる補遺の項目を返す。補遺が出典でない問題では undefined。 */
export function findSupplementEntry(
  sourceFile: string | undefined,
  sourceHeading: string | undefined,
): SupplementEntry | undefined {
  if (!sourceFile || !sourceHeading) return undefined;
  return bySourceKey.get(`${sourceFile}#${sourceHeading}`);
}

/** 補遺の項目へのリンク先（章のページ内のアンカー）。 */
export function supplementEntryPath(entry: SupplementEntry): string {
  return `/materials/${entry.sectionId.slice(0, 4)}#${entry.blockId}`;
}
