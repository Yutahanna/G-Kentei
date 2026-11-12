import type { Section } from "../../schemas/content.schema";
import type {
  SupplementEntry,
  SupplementInline,
  SupplementNode,
} from "../../schemas/supplement.schema";
import AsOfDateNote from "../../shared/ui/AsOfDateNote";
import styles from "./SupplementSection.module.css";

function Inlines({ inlines }: { inlines: SupplementInline[] }) {
  return (
    <>
      {inlines.map((inline, i) =>
        inline.t === "strong" ? (
          <strong key={i}>{inline.v}</strong>
        ) : inline.t === "code" ? (
          <code key={i}>{inline.v}</code>
        ) : (
          <span key={i}>{inline.v}</span>
        ),
      )}
    </>
  );
}

function Nodes({ nodes }: { nodes: SupplementNode[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        if (node.type === "paragraph") {
          return (
            <p key={i} className={styles.paragraph}>
              <Inlines inlines={node.inlines} />
            </p>
          );
        }
        if (node.type === "list") {
          const items = node.items.map((item, j) => (
            <li key={j}>
              <Inlines inlines={item.inlines} />
              {item.children.length > 0 && <Nodes nodes={item.children} />}
            </li>
          ));
          return node.ordered ? (
            <ol key={i} className={styles.list}>
              {items}
            </ol>
          ) : (
            <ul key={i} className={styles.list}>
              {items}
            </ul>
          );
        }
        return (
          <div key={i} className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  {node.header.map((cell, j) => (
                    <th key={j}>
                      <Inlines inlines={cell} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {node.rows.map((row, j) => (
                  <tr key={j}>
                    {row.map((cell, k) => (
                      <td key={k}>
                        <Inlines inlines={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}

function EntryView({ entry }: { entry: SupplementEntry }) {
  const showGroup = entry.kind === "term" && entry.groupTitle !== entry.title;
  return (
    <article id={entry.blockId} className={styles.entry}>
      <h4 className={styles.entryTitle}>{entry.title}</h4>
      <p className={styles.meta}>
        補遺「{entry.supplementTitle}」{showGroup ? `／${entry.groupTitle}` : ""}
        {entry.pageRef ? `・公式テキスト ${entry.pageRef}` : ""}
      </p>
      <Nodes nodes={entry.body} />
      <AsOfDateNote asOfDate={entry.asOfDate} />
    </article>
  );
}

export const SUPPLEMENT_SECTION_ID = "supplements";

/**
 * 章のページの最後に、その章に割り当てた補遺の項目を、章の節ごとにまとめて表示する。
 * 補遺は格納テキストではないため、見た目と注記で章本文と区別する。
 */
export default function SupplementSection({
  sections,
  entries,
}: {
  sections: Section[];
  entries: SupplementEntry[];
}) {
  if (entries.length === 0) return null;
  const groups = sections
    .map((section) => ({
      section,
      items: entries.filter((e) => e.sectionId === section.sectionId),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <section
      id={SUPPLEMENT_SECTION_ID}
      className={styles.root}
      aria-labelledby="supplements-heading"
    >
      <h2 id="supplements-heading" className={styles.heading}>
        補遺：本文を補う用語
      </h2>
      <p className={styles.notice}>
        格納テキストにない、または説明が薄いG検定シラバスのキーワードを補うために、このアプリで独自に作成した資料です。格納テキスト・公式テキストの本文ではありません。ページは公式テキストの該当ページです。この章のドリルで出題する用語確認・計算問題の出典になっています。
      </p>
      <nav aria-label="補遺の節一覧">
        <ul className={styles.toc}>
          {groups.map(({ section, items }) => (
            <li key={section.sectionId}>
              <a href={`#${SUPPLEMENT_SECTION_ID}-${section.sectionId}`}>
                {section.title}（{items.length}）
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {groups.map(({ section, items }) => (
        <div
          key={section.sectionId}
          id={`${SUPPLEMENT_SECTION_ID}-${section.sectionId}`}
          className={styles.group}
        >
          <h3 className={styles.groupTitle}>{section.title} に関連する補遺</h3>
          {items.map((entry) => (
            <EntryView key={entry.blockId} entry={entry} />
          ))}
        </div>
      ))}
    </section>
  );
}
