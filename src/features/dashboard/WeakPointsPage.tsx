import { Link } from "react-router-dom";
import Card from "../../shared/ui/Card";
import { useOverallProgress } from "../../shared/hooks/useOverallProgress";
import { getSection } from "../../shared/lib/content-loader";
import styles from "./WeakPointsPage.module.css";

const DIFFICULTY_LABEL: Record<string, string> = {
  basic: "基礎",
  standard: "標準",
  advanced: "応用",
};

function formatAccuracy(answered: number, accuracy: number): string {
  return answered === 0 ? "未回答" : `${Math.round(accuracy * 100)}%`;
}

export default function WeakPointsPage() {
  const progress = useOverallProgress();

  if (progress.isLoading) {
    return <p>読み込み中です…</p>;
  }

  return (
    <div>
      <h1>弱点分析</h1>
      <p>出題形式・難易度・章・節ごとの正答率から、復習すべきポイントを確認できます。</p>

      <section className={styles.section}>
        <h2>出題形式別の正答率（正答率が低い順）</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>出題形式</th>
              <th>回答済み / 出題数</th>
              <th>正答率</th>
            </tr>
          </thead>
          <tbody>
            {progress.bySkillTag.map((s) => (
              <tr key={s.skillTag}>
                <td>{s.skillTag}</td>
                <td>
                  {s.answered} / {s.total}
                </td>
                <td>{formatAccuracy(s.answered, s.accuracy)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.section}>
        <h2>難易度別の正答率</h2>
        <div className={styles.grid}>
          {(["basic", "standard", "advanced"] as const).map((difficulty) => {
            const stat = progress.byDifficulty[difficulty];
            return (
              <Card key={difficulty}>
                <div className={styles.statValue}>
                  {stat.answered} / {stat.total}
                </div>
                <div className={styles.statLabel}>
                  {DIFFICULTY_LABEL[difficulty]}（正答率{" "}
                  {formatAccuracy(stat.answered, stat.accuracy)}）
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section className={styles.section}>
        <h2>章別の正答率</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>章</th>
              <th>回答済み / 出題数</th>
              <th>正答率</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {progress.byChapter.map((c) => (
              <tr key={c.chapterId}>
                <td>{c.title}</td>
                <td>
                  {c.answered} / {c.total}
                </td>
                <td>{formatAccuracy(c.answered, c.accuracy)}</td>
                <td>
                  <Link to={`/drill?chapter=${c.chapterId}`}>ドリルする</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.section}>
        <h2>弱点候補の節（回答3問以上・正答率60%未満）</h2>
        {progress.weakSections.length === 0 ? (
          <p>現時点で弱点候補として抽出される節はありません。</p>
        ) : (
          <ul className={styles.weakList}>
            {progress.weakSections.map((s) => {
              const section = getSection(s.chapterId, s.sectionId);
              return (
                <li key={s.sectionId} className={styles.weakRow}>
                  <span>
                    {section?.title ?? s.sectionId}（{formatAccuracy(s.answered, s.accuracy)}
                    ・回答{s.answered}問）
                  </span>
                  <span className={styles.weakActions}>
                    <Link to={`/materials/${s.chapterId}#${s.sectionId}`}>教材を見る</Link>
                    <Link to={`/drill?chapter=${s.chapterId}&section=${s.sectionId}`}>
                      この節をドリルする
                    </Link>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
