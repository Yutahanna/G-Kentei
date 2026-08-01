import ch01Raw from "../../../content/chapters/ch01.json";
import ch02Raw from "../../../content/chapters/ch02.json";
import ch03Raw from "../../../content/chapters/ch03.json";
import ch04Raw from "../../../content/chapters/ch04.json";
import ch05Raw from "../../../content/chapters/ch05.json";
import ch06Raw from "../../../content/chapters/ch06.json";
import ch07Raw from "../../../content/chapters/ch07.json";
import ch08Raw from "../../../content/chapters/ch08.json";
import ch09Raw from "../../../content/chapters/ch09.json";
import ch10Raw from "../../../content/chapters/ch10.json";
import manifestRaw from "../../../content/manifest.json";
import {
  chapterSchema,
  manifestSchema,
  type Chapter,
  type Manifest,
} from "../../schemas/content.schema";

/**
 * content/ 配下の生成済み教材JSONを読み込む唯一の入り口。
 * 第1章〜第10章すべてを対象とする。
 */

const manifest: Manifest = manifestSchema.parse(manifestRaw);
const chapters: Record<string, Chapter> = {
  ch01: chapterSchema.parse(ch01Raw),
  ch02: chapterSchema.parse(ch02Raw),
  ch03: chapterSchema.parse(ch03Raw),
  ch04: chapterSchema.parse(ch04Raw),
  ch05: chapterSchema.parse(ch05Raw),
  ch06: chapterSchema.parse(ch06Raw),
  ch07: chapterSchema.parse(ch07Raw),
  ch08: chapterSchema.parse(ch08Raw),
  ch09: chapterSchema.parse(ch09Raw),
  ch10: chapterSchema.parse(ch10Raw),
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
