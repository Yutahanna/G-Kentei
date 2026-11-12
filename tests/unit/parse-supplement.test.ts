import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { makeBlockId, parseSupplement, splitHeading } from "../../scripts/lib/parse-supplement";
import supplementsRaw from "../../content/supplements.json";
import { supplementContentSchema } from "../../src/schemas/supplement.schema";

const read = (name: string) =>
  readFileSync(join(process.cwd(), "materials", "supplements", name), "utf-8");

describe("splitHeading", () => {
  it("末尾の括弧書きから公式テキストのページを取り出す", () => {
    expect(splitHeading("隠れマルコフモデル（HMM）（索引なし。p.272）")).toEqual({
      title: "隠れマルコフモデル（HMM）",
      pageRef: "p.272",
    });
    expect(splitHeading("SENet（Squeeze-and-Excitation Networks）（p.259）")).toEqual({
      title: "SENet（Squeeze-and-Excitation Networks）",
      pageRef: "p.259",
    });
  });

  it("ページのない「索引なし」は見出しから除く", () => {
    expect(splitHeading("Vision Transformer（ViT）（索引なし）")).toEqual({
      title: "Vision Transformer（ViT）",
    });
  });

  it("ページ番号でない括弧書きは見出しに残す", () => {
    expect(splitHeading("感情分析（音声）（p.273）")).toEqual({
      title: "感情分析（音声）",
      pageRef: "p.273",
    });
    expect(splitHeading("PPO（Proximal Policy Optimization）")).toEqual({
      title: "PPO（Proximal Policy Optimization）",
    });
  });
});

describe("parseSupplement（音声処理）", () => {
  const parsed = parseSupplement(read("6-2_音声処理_ORG.md"));
  const allText = JSON.stringify(parsed.blocks);

  it("補遺の名前を取り出す", () => {
    expect(parsed.title).toBe("音声処理");
  });

  it("### の用語を出現順に取り出す", () => {
    const terms = parsed.blocks.filter((b) => b.kind === "term").map((b) => b.title);
    expect(terms[0]).toBe("A-D変換");
    expect(terms).toContain("隠れマルコフモデル（HMM）");
    expect(terms).toHaveLength(13);
  });

  it("冒頭の管理用記述、確認欄、公式テキストとの照合記録、取り違えやすい組を含めない", () => {
    expect(allText).not.toContain("状態：ORG");
    expect(allText).not.toContain("確認欄");
    expect(allText).not.toContain("公式テキストでの説明");
    expect(allText).not.toContain("公式テキストとの差異");
    expect(parsed.blocks.some((b) => b.groupHeading.startsWith("取り違えやすい組"))).toBe(false);
  });

  it("説明の本文は残す", () => {
    expect(allText).toContain("意味を区別する最小の音の単位");
  });
});

describe("parseSupplement（法律と契約）", () => {
  it("冒頭の確認基準日を取り出す", () => {
    expect(parseSupplement(read("9_法律と契約_ORG.md")).asOfDate).toBe("2026-11-06");
  });
});

describe("makeBlockId", () => {
  it("同じ補遺・見出しからは同じIDを作る（決定性）", () => {
    expect(makeBlockId("6-2_音声処理_ORG.md", "A-D変換（p.270）")).toBe(
      makeBlockId("6-2_音声処理_ORG.md", "A-D変換（p.270）"),
    );
    expect(makeBlockId("6-2_音声処理_ORG.md", "A-D変換（p.270）")).toMatch(/^sup-6-2-[0-9a-f]{8}$/);
  });
});

describe("content/supplements.json", () => {
  const content = supplementContentSchema.parse(supplementsRaw);

  it("生成物が補遺の現在の内容と一致する（補遺を直したら npm run build:supplements を実行する）", () => {
    for (const source of content.sources) {
      const markdown = readFileSync(join(process.cwd(), source.sourceFile), "utf-8");
      expect(parseSupplement(markdown).contentHash, source.sourceFile).toBe(source.contentHash);
    }
  });
});
