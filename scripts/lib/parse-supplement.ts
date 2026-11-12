/**
 * materials/supplements/*_ORG.md（補遺）の1ファイル分のMarkdownを、画面表示用の項目（ブロック）に分ける純粋関数群。
 * scripts/build-supplements.ts から呼び出されるほか、tests/unit/parse-supplement.test.ts で回帰テストする。
 *
 * 学習者に見せない記述は、ここで取り除く。
 * - 冒頭の管理用の記述（最初の水平線 `---` より前）：状態、変更履歴、書き方、確認欄の説明など
 * - 「取り違えやすい組（用語確認ドリルの誤答に使う）」の節：問題作成用の資料
 * - 項目の中の、確認欄と公式テキストとの照合記録の箇条書き（EXCLUDED_LABEL_PATTERNS）
 */
import { createHash } from "node:crypto";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { toString as toPlainText } from "mdast-util-to-string";
import type { List, ListItem, PhrasingContent, Root, RootContent, Table } from "mdast";
import type { SupplementInline, SupplementNode } from "../../src/schemas/supplement.schema";

/** 箇条書きの先頭の太字ラベルがこれに当たる項目は表示しない（照合の記録であり、学習内容ではない）。 */
const EXCLUDED_LABEL_PATTERNS: RegExp[] = [
  /^確認欄/,
  /^公式テキストで/,
  /^公式テキストとの/,
  /^対応（反映済み）/,
];

/** この見出しで始まる ## 節は、まるごと表示しない。 */
const EXCLUDED_GROUP_PATTERNS: RegExp[] = [/^取り違えやすい組/];

export interface SupplementBlockDraft {
  kind: "term" | "intro";
  /** 照合キー。term は ### の見出し、intro は "## " + ## の見出し */
  key: string;
  heading: string;
  title: string;
  pageRef?: string;
  groupHeading: string;
  /** ## の見出しから番号（"1. "）とページを除いたもの */
  groupTitle: string;
  body: SupplementNode[];
}

export interface ParsedSupplement {
  title: string;
  contentHash: string;
  asOfDate?: string;
  blocks: SupplementBlockDraft[];
}

export function hashText(text: string): string {
  return createHash("sha256").update(text, "utf-8").digest("hex");
}

/** 補遺ファイル名と照合キーから、画面内アンカー用のIDを作る（例: "sup-6-2-1a2b3c4d"）。 */
export function makeBlockId(fileName: string, key: string): string {
  const prefix = (fileName.split("_")[0] ?? "x").replace(/[^\w-]/g, "");
  return `sup-${prefix}-${hashText(`${fileName}#${key}`).slice(0, 8)}`;
}

/**
 * 見出しの末尾の括弧書き（ページ番号・索引の有無）を、表示用の見出しとページに分ける。
 * 例: "隠れマルコフモデル（HMM）（索引なし。p.272）" → { title: "隠れマルコフモデル（HMM）", pageRef: "p.272" }
 *     "Vision Transformer（ViT）（索引なし）" → { title: "Vision Transformer（ViT）" }
 */
export function splitHeading(heading: string): { title: string; pageRef?: string } {
  const match = /^(.*)（([^（）]*)）$/.exec(heading.trim());
  if (!match) return { title: heading.trim() };
  const [, rest = "", inner = ""] = match;
  const isMeta = /p\.\d|索引なし|公式テキスト/.test(inner);
  if (!isMeta || rest.trim() === "") return { title: heading.trim() };
  const pages = inner
    .split("。")
    .map((part) => part.trim().replace(/^公式テキスト\s*/, ""))
    .filter((part) => /p\.\d/.test(part));
  const pageRef = pages.join("。");
  return pageRef ? { title: rest.trim(), pageRef } : { title: rest.trim() };
}

/** 見出し先頭の番号（"1. " など）を除く。 */
function stripNumber(title: string): string {
  return title.replace(/^\d+\.\s*/, "");
}

function toInlines(nodes: PhrasingContent[]): SupplementInline[] {
  const out: SupplementInline[] = [];
  const push = (t: SupplementInline["t"], v: string) => {
    if (v === "") return;
    const last = out[out.length - 1];
    if (last && last.t === t && t === "text") {
      last.v += v;
    } else {
      out.push({ t, v });
    }
  };
  for (const node of nodes) {
    if (node.type === "strong") push("strong", toPlainText(node));
    else if (node.type === "inlineCode") push("code", node.value);
    else if (node.type === "break") push("text", "\n");
    else push("text", toPlainText(node));
  }
  return out;
}

function firstStrongLabel(item: ListItem): string | undefined {
  const first = item.children[0];
  if (!first || first.type !== "paragraph") return undefined;
  const head = first.children[0];
  return head && head.type === "strong" ? toPlainText(head).trim() : undefined;
}

function isExcludedItem(item: ListItem): boolean {
  const label = firstStrongLabel(item);
  return label !== undefined && EXCLUDED_LABEL_PATTERNS.some((p) => p.test(label));
}

function convertList(list: List): SupplementNode | undefined {
  const items: { inlines: SupplementInline[]; children: SupplementNode[] }[] = [];
  for (const item of list.children) {
    if (isExcludedItem(item)) continue;
    const inlines: SupplementInline[] = [];
    const children: SupplementNode[] = [];
    for (const child of item.children) {
      if (child.type === "paragraph" && children.length === 0) {
        if (inlines.length > 0) inlines.push({ t: "text", v: "\n" });
        inlines.push(...toInlines(child.children));
      } else {
        const converted = convertNode(child);
        if (converted) children.push(converted);
      }
    }
    items.push({ inlines, children });
  }
  return items.length > 0 ? { type: "list", ordered: list.ordered === true, items } : undefined;
}

function convertTable(table: Table): SupplementNode {
  const [headRow, ...bodyRows] = table.children;
  return {
    type: "table",
    header: (headRow?.children ?? []).map((cell) => toInlines(cell.children)),
    rows: bodyRows.map((row) => row.children.map((cell) => toInlines(cell.children))),
  };
}

function convertNode(node: RootContent): SupplementNode | undefined {
  switch (node.type) {
    case "paragraph":
      return { type: "paragraph", inlines: toInlines(node.children) };
    case "list":
      return convertList(node);
    case "table":
      return convertTable(node);
    case "thematicBreak":
    case "html":
      return undefined;
    default:
      throw new Error(`補遺の変換に対応していない要素です: ${node.type}`);
  }
}

function parseTitle(root: Root): string {
  const h1 = root.children.find((n) => n.type === "heading" && n.depth === 1);
  if (!h1) throw new Error("補遺に # の見出しがありません");
  const text = toPlainText(h1).trim();
  return text
    .replace(/^補遺[：:]\s*/, "")
    .replace(/（ORG）$/, "")
    .trim();
}

function parseAsOfDate(headerNodes: RootContent[]): string | undefined {
  for (const node of headerNodes) {
    const text = toPlainText(node);
    const match = /確認基準日[：:]\s*(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(text);
    if (match) {
      const [, y = "", m = "", d = ""] = match;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }
  return undefined;
}

export function parseSupplement(markdown: string): ParsedSupplement {
  const root = unified().use(remarkParse).use(remarkGfm).parse(markdown);
  const title = parseTitle(root);

  const firstBreak = root.children.findIndex((n) => n.type === "thematicBreak");
  if (firstBreak < 0)
    throw new Error(`補遺「${title}」に冒頭の管理用記述を区切る --- がありません`);
  const header = root.children.slice(0, firstBreak);
  const asOfDate = parseAsOfDate(header);

  const blocks: SupplementBlockDraft[] = [];
  let groupHeading = "";
  let groupTitle = "";
  let skipGroup = false;
  let current: SupplementBlockDraft | undefined;

  const flush = () => {
    if (current && current.body.length > 0) blocks.push(current);
    current = undefined;
  };

  for (const node of root.children.slice(firstBreak + 1)) {
    if (node.type === "heading" && node.depth === 2) {
      flush();
      groupHeading = toPlainText(node).trim();
      groupTitle = stripNumber(splitHeading(groupHeading).title);
      skipGroup = EXCLUDED_GROUP_PATTERNS.some((p) => p.test(groupHeading));
      if (!skipGroup) {
        current = {
          kind: "intro",
          key: `## ${groupHeading}`,
          heading: groupHeading,
          ...splitHeading(groupHeading),
          title: groupTitle,
          groupHeading,
          groupTitle,
          body: [],
        };
      }
      continue;
    }
    if (skipGroup) continue;
    if (node.type === "heading" && node.depth === 3) {
      flush();
      const heading = toPlainText(node).trim();
      current = {
        kind: "term",
        key: heading,
        heading,
        ...splitHeading(heading),
        groupHeading,
        groupTitle,
        body: [],
      };
      continue;
    }
    if (node.type === "heading") {
      throw new Error(`補遺「${title}」に想定外の見出しの深さがあります: ${toPlainText(node)}`);
    }
    const converted = convertNode(node);
    if (!converted) continue;
    if (!current) {
      throw new Error(
        `補遺「${title}」で、見出しより前に本文があります: ${toPlainText(node).slice(0, 40)}`,
      );
    }
    current.body.push(converted);
  }
  flush();

  return {
    title,
    contentHash: hashText(markdown),
    ...(asOfDate ? { asOfDate } : {}),
    blocks,
  };
}
