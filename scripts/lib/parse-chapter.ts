/**
 * materials/chapters/*.md の1章分のMarkdown文字列を Chapter 構造体へ変換する純粋関数群。
 * scripts/build-content.ts から呼び出されるほか、tests/unit/parse-chapter.test.ts で
 * パーサー自体の回帰テストに使う。
 */
import { createHash } from "node:crypto";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { toString as toPlainText } from "mdast-util-to-string";
import type { RootContent, ListItem, Table } from "mdast";
import type { Chapter, ChapterSummary, Section } from "../../src/schemas/content.schema";

/** 章番号(1始まり) → materials/chapters/ 配下のファイル名。materials/INDEX.md の並び順に対応する。 */
export const CHAPTER_FILES: Record<number, string> = {
  1: "04_第1章.md",
  2: "05_第2章.md",
  3: "06_第3章.md",
  4: "07_第4章.md",
  5: "08_第5章.md",
  6: "09_第6章.md",
  7: "10_第7章.md",
  8: "11_第8章.md",
  9: "12_第9章.md",
  10: "13_第10章.md",
};

/** materials/03_推奨学習順.md に基づく推奨学習順（0始まりのインデックス）。 */
export const RECOMMENDED_ORDER: Record<number, number> = {
  3: 0,
  4: 1,
  5: 2,
  6: 3,
  7: 4,
  8: 5,
  9: 6,
  10: 7,
  1: 8,
  2: 9,
};

function isHtmlCommentNode(node: RootContent): boolean {
  return node.type === "html" && node.value.trim() === "<!-- -->";
}

function isHeading(
  node: RootContent | undefined,
  depth?: number,
): node is RootContent & { type: "heading"; depth: number } {
  if (!node || node.type !== "heading") return false;
  return depth === undefined || node.depth === depth;
}

/**
 * 段落・箇条書きが混在するブロック（まずイメージ／仕組みと背景 等）を、
 * 次の見出しが現れるまでプレーンテキストとして連結する。
 * 箇条書きは "- " 接頭辞つきの行として保持し、情報を失わないようにする。
 */
function collectBlockText(
  children: RootContent[],
  startIndex: number,
): { text: string; nextIndex: number } {
  const parts: string[] = [];
  let i = startIndex;
  while (i < children.length) {
    const node = children[i];
    if (!node) break;
    if (isHtmlCommentNode(node)) {
      i++;
      continue;
    }
    if (node.type === "paragraph") {
      parts.push(toPlainText(node));
      i++;
      continue;
    }
    if (node.type === "list") {
      for (const item of node.children) {
        parts.push(`- ${toPlainText(item)}`);
      }
      i++;
      continue;
    }
    if (node.type === "table") {
      const rows = node.children.map((row) =>
        row.children.map((cell) => toPlainText(cell).trim()).join(" | "),
      );
      parts.push(rows.join("\n"));
      i++;
      continue;
    }
    break;
  }
  return { text: parts.join("\n\n"), nextIndex: i };
}

/** 単純な箇条書き（この節のポイント／確認ポイント／この章で学ぶこと）を配列として取得する。 */
function collectListItems(
  children: RootContent[],
  startIndex: number,
): { items: string[]; nextIndex: number } {
  const items: string[] = [];
  let i = startIndex;
  while (i < children.length) {
    const node = children[i];
    if (!node) break;
    if (isHtmlCommentNode(node)) {
      i++;
      continue;
    }
    if (node.type === "list") {
      for (const item of node.children) {
        items.push(toPlainText(item));
      }
      i++;
      continue;
    }
    break;
  }
  return { items, nextIndex: i };
}

interface SupplementaryTermDraft {
  term: string;
  importance: "A" | "B" | "C";
  description: string;
}

function parseSupplementaryTermItem(item: ListItem): SupplementaryTermDraft {
  const paragraph = item.children.find((c) => c.type === "paragraph");
  if (!paragraph || paragraph.type !== "paragraph") {
    throw new Error("本文を補う用語の項目に段落が見つかりません");
  }
  const strongNode = paragraph.children.find((c) => c.type === "strong");
  if (!strongNode) {
    throw new Error(
      `本文を補う用語の項目に強調（用語）が見つかりません: ${toPlainText(paragraph)}`,
    );
  }
  const rawTerm = toPlainText(strongNode);
  const match = /^(.+)（([ABC])）$/.exec(rawTerm);
  if (!match) {
    throw new Error(`重要度ラベル（A/B/C）を用語から読み取れません: "${rawTerm}"`);
  }
  const [, term, importance] = match;
  const fullText = toPlainText(paragraph);
  const description = fullText.slice(rawTerm.length).replace(/^：/, "").trim();
  return { term: term!.trim(), importance: importance as "A" | "B" | "C", description };
}

function parseKeyDistinctionsTable(table: Table): { item: string; criterion: string }[] {
  const [, ...dataRows] = table.children;
  return dataRows.map((row) => {
    const [itemCell, criterionCell] = row.children;
    return {
      item: itemCell ? toPlainText(itemCell).trim() : "",
      criterion: criterionCell ? toPlainText(criterionCell).trim() : "",
    };
  });
}

function parseChapterSummary(children: RootContent[], startIndex: number): ChapterSummary {
  let i = startIndex;
  let conceptMap = "";
  let supplementaryTerms: SupplementaryTermDraft[] = [];
  let keyDistinctions: { item: string; criterion: string }[] = [];
  let checkpoints: string[] = [];

  while (i < children.length) {
    const node = children[i];
    if (!node) break;

    if (isHeading(node, 3) && toPlainText(node) === "この章の理解マップ") {
      const result = collectBlockText(children, i + 1);
      conceptMap = result.text;
      i = result.nextIndex;
      continue;
    }
    if (isHeading(node, 3) && toPlainText(node) === "本文を補う用語") {
      let j = i + 1;
      const terms: SupplementaryTermDraft[] = [];
      while (j < children.length) {
        const n = children[j];
        if (!n) break;
        if (isHtmlCommentNode(n)) {
          j++;
          continue;
        }
        if (n.type === "list") {
          for (const listItem of n.children) {
            terms.push(parseSupplementaryTermItem(listItem));
          }
          j++;
          continue;
        }
        break;
      }
      supplementaryTerms = terms;
      i = j;
      continue;
    }
    if (isHeading(node, 3) && toPlainText(node) === "重要な区別") {
      const tableNode = children[i + 1];
      if (tableNode && tableNode.type === "table") {
        keyDistinctions = parseKeyDistinctionsTable(tableNode);
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (isHeading(node, 3) && toPlainText(node) === "確認ポイント") {
      const result = collectListItems(children, i + 1);
      checkpoints = result.items;
      i = result.nextIndex;
      continue;
    }
    if (isHeading(node, 2)) {
      break;
    }
    i++;
  }

  return { conceptMap, supplementaryTerms, keyDistinctions, checkpoints };
}

export function parseChapter(chapterNumber: number, markdown: string): Chapter {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown);
  const children = tree.children;

  const titleHeading = children[0];
  if (!isHeading(titleHeading, 1)) {
    throw new Error("先頭が章タイトル（# 見出し）ではありません");
  }
  const titleMatch = /^第\d+章\s*(.+)$/.exec(toPlainText(titleHeading));
  const title = titleMatch ? titleMatch[1]!.trim() : toPlainText(titleHeading);

  const chapterId = `ch${String(chapterNumber).padStart(2, "0")}`;

  let i = 1;
  if (!isHeading(children[i], 2) || toPlainText(children[i]!) !== "この章で学ぶこと") {
    throw new Error('"## この章で学ぶこと" が見つかりません');
  }
  const goalsResult = collectListItems(children, i + 1);
  const learningGoals = goalsResult.items;
  i = goalsResult.nextIndex;

  // 章によっては、学習目標の箇条書きに続けて章全体の補足説明の段落が入ることがある
  // （例: 第5章の「本章は2024年のシラバス改訂で最も比重が増した領域であり…」）。
  // 教材本文を欠落させないよう、この段落があれば学習目標の末尾に追加として取り込む。
  const goalsNoteResult = collectBlockText(children, i);
  if (goalsNoteResult.text.length > 0) {
    learningGoals.push(goalsNoteResult.text);
    i = goalsNoteResult.nextIndex;
  }

  const sections: Section[] = [];
  let sectionIndex = 0;
  while (isHeading(children[i], 2) && /^\d+(\.\d+)?\.\s*/.test(toPlainText(children[i]!))) {
    sectionIndex++;
    const sectionTitle = toPlainText(children[i]!);
    i++;

    const introHeading = children[i];
    if (!isHeading(introHeading, 3)) {
      throw new Error(
        `節「${sectionTitle}」に導入見出し（まずイメージ／要点と使い分け）がありません`,
      );
    }
    const introHeadingText = toPlainText(introHeading);
    const introType: Section["introType"] =
      introHeadingText === "まずイメージ"
        ? "image"
        : introHeadingText === "要点と使い分け"
          ? "concise"
          : (() => {
              throw new Error(`未知の導入見出しです: "${introHeadingText}"`);
            })();
    const introResult = collectBlockText(children, i + 1);
    const introText = introResult.text;
    i = introResult.nextIndex;

    let mechanismText: string | undefined;
    if (isHeading(children[i], 3) && toPlainText(children[i]!) === "仕組みと背景") {
      const mechanismResult = collectBlockText(children, i + 1);
      mechanismText = mechanismResult.text;
      i = mechanismResult.nextIndex;
    }

    if (
      !(isHeading(children[i], 4) || isHeading(children[i], 3)) ||
      toPlainText(children[i]!) !== "この節のポイント"
    ) {
      throw new Error(`節「${sectionTitle}」に "この節のポイント" が見つかりません`);
    }
    const keyPointsResult = collectListItems(children, i + 1);
    i = keyPointsResult.nextIndex;

    sections.push({
      sectionId: `${chapterId}-s${String(sectionIndex).padStart(2, "0")}`,
      index: sectionIndex,
      title: sectionTitle,
      introType,
      introText,
      mechanismText,
      keyPoints: keyPointsResult.items,
    });
  }

  let transitionNote: string | undefined;
  if (isHeading(children[i], 2) && toPlainText(children[i]!).includes("次章へのつながり")) {
    const result = collectBlockText(children, i + 1);
    transitionNote = result.text;
    i = result.nextIndex;
  }

  if (!isHeading(children[i], 2) || !toPlainText(children[i]!).startsWith("章末整理")) {
    throw new Error('"## 章末整理：〜" が見つかりません');
  }
  const summary = parseChapterSummary(children, i + 1);

  const contentHash = createHash("sha256").update(markdown, "utf-8").digest("hex");

  return {
    chapterId,
    number: chapterNumber,
    title,
    sourceFile: `materials/chapters/${CHAPTER_FILES[chapterNumber]}`,
    contentHash,
    recommendedOrderIndex: RECOMMENDED_ORDER[chapterNumber] ?? chapterNumber - 1,
    learningGoals,
    sections,
    transitionNote,
    summary,
  };
}
