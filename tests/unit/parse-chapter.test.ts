import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseChapter } from "../../scripts/lib/parse-chapter";

const CH01_PATH = join(process.cwd(), "materials", "chapters", "04_第1章.md");

describe("parseChapter（第1章）", () => {
  const markdown = readFileSync(CH01_PATH, "utf-8");
  const chapter = parseChapter(1, markdown);

  it("章の基本情報を正しく抽出する", () => {
    expect(chapter.chapterId).toBe("ch01");
    expect(chapter.number).toBe(1);
    expect(chapter.title).toBe("人工知能とは");
    expect(chapter.sourceFile).toBe("materials/chapters/04_第1章.md");
  });

  it("この章で学ぶことを3件抽出する", () => {
    expect(chapter.learningGoals).toHaveLength(3);
  });

  it("5つの節を、見出しの出現順どおりのsectionIdで抽出する", () => {
    expect(chapter.sections).toHaveLength(5);
    expect(chapter.sections.map((s) => s.sectionId)).toEqual([
      "ch01-s01",
      "ch01-s02",
      "ch01-s03",
      "ch01-s04",
      "ch01-s05",
    ]);
  });

  it("「要点と使い分け」節はintroType=conciseになり、仕組みと背景を持たない", () => {
    const section1 = chapter.sections[0]!;
    expect(section1.introType).toBe("concise");
    expect(section1.mechanismText).toBeUndefined();
    expect(section1.keyPoints).toHaveLength(3);
  });

  it("「まずイメージ」節はintroType=imageになり、仕組みと背景を持つ", () => {
    const section2 = chapter.sections[1]!;
    expect(section2.introType).toBe("image");
    expect(section2.mechanismText).toBeDefined();
    expect(section2.mechanismText).toContain("AI効果");
  });

  it("箇条書きが混在するブロックでも本文を欠落させない（人工知能レベルの4分類）", () => {
    const section3 = chapter.sections[2]!;
    expect(section3.mechanismText).toContain("レベル1: 単純な制御プログラム");
    expect(section3.mechanismText).toContain("レベル4: 深層学習を取り入れたAI");
  });

  it("章末整理（用語・重要な区別・確認ポイント）を抽出する", () => {
    expect(chapter.summary.supplementaryTerms).toHaveLength(4);
    expect(chapter.summary.supplementaryTerms[0]).toEqual({
      term: "エージェント",
      importance: "B",
      description:
        "環境を認識し、目標に向けて行動を選択する主体。ソフトウェアだけの場合も、ロボットのように身体を持つ場合もある。",
    });
    expect(chapter.summary.keyDistinctions).toHaveLength(4);
    expect(chapter.summary.checkpoints).toHaveLength(3);
  });

  it("同じMarkdownからは同じcontentHashを再現する（決定性）", () => {
    const again = parseChapter(1, markdown);
    expect(again.contentHash).toBe(chapter.contentHash);
  });
});
