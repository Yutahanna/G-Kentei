import ch01Raw from "../../../content/chapters/ch01.json";
import manifestRaw from "../../../content/manifest.json";
import {
  chapterSchema,
  manifestSchema,
  type Chapter,
  type Manifest,
} from "../../schemas/content.schema";

/**
 * content/ 配下の生成済み教材JSONを読み込む唯一の入り口。
 * フェーズ1では第1章のみを対象とする（docs/phase0-design.md 11節）。
 */

const manifest: Manifest = manifestSchema.parse(manifestRaw);
const chapters: Record<string, Chapter> = {
  ch01: chapterSchema.parse(ch01Raw),
};

export function getManifest(): Manifest {
  return manifest;
}

export function getChapter(chapterId: string): Chapter | undefined {
  return chapters[chapterId];
}

export function getAvailableChapterIds(): string[] {
  return Object.keys(chapters);
}

export function getSection(chapterId: string, sectionId: string) {
  return getChapter(chapterId)?.sections.find((s) => s.sectionId === sectionId);
}
