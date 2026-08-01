import { Link } from "react-router-dom";
import Card from "../../shared/ui/Card";
import buttonStyles from "../../shared/ui/Button.module.css";
import ProgressBar from "../../shared/ui/ProgressBar";
import { useChapterProgress } from "../../shared/hooks/useChapterProgress";
import { getChapter } from "../../shared/lib/content-loader";
import styles from "./DashboardPage.module.css";

const CHAPTER_ID = "ch01";

export default function DashboardPage() {
  const chapter = getChapter(CHAPTER_ID);
  const progress = useChapterProgress(CHAPTER_ID);

  const sectionRatio =
    progress.totalSections === 0 ? 0 : progress.readSections / progress.totalSections;
  const questionRatio =
    progress.totalQuestions === 0 ? 0 : progress.answeredQuestions / progress.totalQuestions;

  const suggestion = getSuggestion(progress);

  return (
    <div>
      <h1>ホーム</h1>
      <p>
        現在は第1章「{chapter?.title}
        」のみが利用できます（フェーズ1）。全章対応はフェーズ2以降に順次追加予定です。
      </p>

      <div className={styles.section}>
        <Card>
          <div className={styles.suggestion}>
            <div>
              <div className={styles.sectionTitle}>今日取り組むべき内容</div>
              <p>{suggestion.text}</p>
            </div>
            {suggestion.to ? (
              <Link to={suggestion.to} className={buttonStyles.button}>
                {suggestion.actionLabel}
              </Link>
            ) : (
              <button type="button" className={buttonStyles.button} disabled>
                {suggestion.actionLabel}
              </button>
            )}
          </div>
        </Card>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>第1章の学習進捗</div>
        <div className={styles.grid}>
          <Card>
            <div className={styles.statValue}>
              {progress.readSections} / {progress.totalSections}
            </div>
            <div className={styles.statLabel}>教材：既読の節</div>
            <ProgressBar ratio={sectionRatio} label="教材既読率" />
          </Card>
          <Card>
            <div className={styles.statValue}>
              {progress.answeredQuestions} / {progress.totalQuestions}
            </div>
            <div className={styles.statLabel}>ドリル：回答済み問題数</div>
            <ProgressBar ratio={questionRatio} label="回答済み率" />
          </Card>
          <Card>
            <div className={styles.statValue}>{Math.round(progress.accuracy * 100)}%</div>
            <div className={styles.statLabel}>直近の正答率（回答済み問題のうち）</div>
          </Card>
          <Card>
            <div className={styles.statValue}>{progress.masteredQuestions}</div>
            <div className={styles.statLabel}>習得済み問題数</div>
          </Card>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>難易度別の状況</div>
        <div className={styles.grid}>
          {(["basic", "standard", "advanced"] as const).map((difficulty) => {
            const stat = progress.byDifficulty[difficulty];
            const label = { basic: "基礎", standard: "標準", advanced: "応用" }[difficulty];
            const accuracy = stat.answered === 0 ? 0 : stat.correct / stat.answered;
            return (
              <Card key={difficulty}>
                <div className={styles.statValue}>
                  {stat.answered} / {stat.total}
                </div>
                <div className={styles.statLabel}>
                  {label}（正答率 {Math.round(accuracy * 100)}%）
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getSuggestion(progress: ReturnType<typeof useChapterProgress>): {
  text: string;
  actionLabel: string;
  to?: string;
} {
  if (progress.isLoading) {
    return { text: "読み込み中です…", actionLabel: "読み込み中" };
  }
  if (progress.readSections < progress.totalSections) {
    return {
      text: "第1章の教材をまだ最後まで読んでいません。まずは本文に目を通しましょう。",
      actionLabel: "教材を読む",
      to: "/materials/ch01",
    };
  }
  if (progress.answeredQuestions < progress.totalQuestions) {
    return {
      text: "未回答の問題が残っています。章別ドリルで解いてみましょう。",
      actionLabel: "ドリルを始める",
      to: "/drill",
    };
  }
  if (progress.dueForReviewQuestions > 0) {
    return {
      text: `復習が必要な問題が${progress.dueForReviewQuestions}問あります。誤答フィルタでドリルを実行しましょう。`,
      actionLabel: "ドリルを始める",
      to: "/drill",
    };
  }
  return {
    text: "第1章の教材・問題に一通り取り組みました。お疲れさまでした。",
    actionLabel: "ドリルを見直す",
    to: "/drill",
  };
}
