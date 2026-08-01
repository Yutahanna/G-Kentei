import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Card from "../../shared/ui/Card";
import buttonStyles from "../../shared/ui/Button.module.css";
import { getChapter } from "../../shared/lib/content-loader";
import { getMaterialReadState, markSectionRead } from "../../shared/lib/db";
import styles from "./ChapterViewPage.module.css";

export default function ChapterViewPage() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const chapter = chapterId ? getChapter(chapterId) : undefined;
  const [readSectionIds, setReadSectionIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!chapter) return;
    let cancelled = false;
    void Promise.all(chapter.sections.map((s) => getMaterialReadState(s.sectionId))).then(
      (states) => {
        if (cancelled) return;
        setReadSectionIds(new Set(states.filter((s) => s.readAt !== null).map((s) => s.sectionId)));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [chapter]);

  if (!chapter) {
    return (
      <div>
        <h1>章が見つかりません</h1>
        <Link to="/materials">教材一覧に戻る</Link>
      </div>
    );
  }

  async function handleMarkRead(sectionId: string) {
    await markSectionRead(sectionId);
    setReadSectionIds((prev) => new Set(prev).add(sectionId));
  }

  return (
    <div>
      <h1>{chapter.title}</h1>

      <h2>この章で学ぶこと</h2>
      <ul className={styles.goalsList}>
        {chapter.learningGoals.map((goal, i) => (
          <li key={i}>{goal}</li>
        ))}
      </ul>

      <nav aria-label="節一覧">
        <ul className={styles.toc}>
          {chapter.sections.map((section) => (
            <li key={section.sectionId}>
              <a href={`#${section.sectionId}`} className={styles.tocLink}>
                {readSectionIds.has(section.sectionId) ? "✓ " : ""}
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {chapter.sections.map((section) => (
        <section key={section.sectionId} id={section.sectionId} className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{section.title}</h2>
            {readSectionIds.has(section.sectionId) && (
              <span className={styles.readBadge}>既読 ✓</span>
            )}
          </div>

          <span className={styles.introLabel}>
            {section.introType === "image" ? "まずイメージ" : "要点と使い分け"}
          </span>
          <p className={styles.body}>{section.introText}</p>

          {section.mechanismText && (
            <>
              <span className={styles.introLabel}>仕組みと背景</span>
              <p className={styles.body}>{section.mechanismText}</p>
            </>
          )}

          <div className={styles.keyPoints}>
            <strong>この節のポイント</strong>
            <ul>
              {section.keyPoints.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={buttonStyles.button}
              onClick={() => void handleMarkRead(section.sectionId)}
              disabled={readSectionIds.has(section.sectionId)}
            >
              {readSectionIds.has(section.sectionId) ? "既読にしました" : "既読にする"}
            </button>
            <Link
              to={`/drill?section=${section.sectionId}`}
              className={`${buttonStyles.button} ${buttonStyles.secondary}`}
            >
              この節の問題を解く
            </Link>
          </div>
        </section>
      ))}

      {chapter.transitionNote && (
        <Card>
          <h2>次章へのつながり</h2>
          <p className={styles.body}>{chapter.transitionNote}</p>
        </Card>
      )}

      <h2>章末整理</h2>
      <Card>
        <h3>この章の理解マップ</h3>
        <p className={styles.body}>{chapter.summary.conceptMap}</p>
      </Card>

      {chapter.summary.supplementaryTerms.length > 0 && (
        <Card>
          <h3>本文を補う用語</h3>
          <div className={styles.termGrid}>
            {chapter.summary.supplementaryTerms.map((term) => (
              <div key={term.term}>
                <strong>{term.term}</strong>
                <span className={styles.termImportance}>（重要度: {term.importance}）</span>
                <p className={styles.body}>{term.description}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {chapter.summary.keyDistinctions.length > 0 && (
        <Card>
          <h3>重要な区別</h3>
          <table>
            <thead>
              <tr>
                <th>区別</th>
                <th>判断の軸</th>
              </tr>
            </thead>
            <tbody>
              {chapter.summary.keyDistinctions.map((row) => (
                <tr key={row.item}>
                  <td>{row.item}</td>
                  <td>{row.criterion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {chapter.summary.checkpoints.length > 0 && (
        <Card>
          <h3>確認ポイント</h3>
          <ul>
            {chapter.summary.checkpoints.map((cp, i) => (
              <li key={i}>{cp}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
