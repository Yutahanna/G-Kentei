import { useState } from "react";
import { Link } from "react-router-dom";
import Card from "../../shared/ui/Card";
import buttonStyles from "../../shared/ui/Button.module.css";
import ProgressBar from "../../shared/ui/ProgressBar";
import { useChapterProgress } from "../../shared/hooks/useChapterProgress";
import { useOverallProgress } from "../../shared/hooks/useOverallProgress";
import { getAvailableChapterIds, getChapter, getManifest } from "../../shared/lib/content-loader";
import styles from "./DashboardPage.module.css";

export default function DashboardPage() {
  const manifest = getManifest();
  const availableChapterIds = getAvailableChapterIds();
  const orderedChapterIds = manifest.chapters
    .map((c) => c.chapterId)
    .filter((id) => availableChapterIds.includes(id));

  const [chapterId, setChapterId] = useState(orderedChapterIds[0] ?? "");
  const chapter = getChapter(chapterId);
  const progress = useChapterProgress(chapterId);
  const overall = useOverallProgress();

  const sectionRatio =
    progress.totalSections === 0 ? 0 : progress.readSections / progress.totalSections;
  const questionRatio =
    progress.totalQuestions === 0 ? 0 : progress.answeredQuestions / progress.totalQuestions;

  const overallSectionRatio =
    overall.totalSections === 0 ? 0 : overall.readSections / overall.totalSections;
  const overallQuestionRatio =
    overall.totalQuestions === 0 ? 0 : overall.answeredQuestions / overall.totalQuestions;

  const suggestion = getSuggestion(progress, chapterId);

  return (
    <div>
      <h1>ホーム</h1>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>全10章の学習状況</div>
        <div className={styles.grid}>
          <Card>
            <div className={styles.statValue}>
              {overall.readSections} / {overall.totalSections}
            </div>
            <div className={styles.statLabel}>教材：既読の節（全章）</div>
            <ProgressBar ratio={overallSectionRatio} label="全章の教材既読率" />
          </Card>
          <Card>
            <div className={styles.statValue}>
              {overall.answeredQuestions} / {overall.totalQuestions}
            </div>
            <div className={styles.statLabel}>ドリル：回答済み問題数（全章）</div>
            <ProgressBar ratio={overallQuestionRatio} label="全章の回答済み率" />
          </Card>
          <Card>
            <div className={styles.statValue}>{Math.round(overall.accuracy * 100)}%</div>
            <div className={styles.statLabel}>全章の正答率（回答済み問題のうち）</div>
          </Card>
          <Card>
            <div className={styles.statValue}>{overall.dueForReviewQuestions}</div>
            <div className={styles.statLabel}>復習が必要な問題数（全章）</div>
            <Link to="/review">復習する</Link>
          </Card>
        </div>
        <p className={styles.weakPointsLink}>
          <Link to="/weak-points">弱点分析（出題形式・難易度・章・節別の正答率）を見る</Link>
        </p>
      </div>

      <div className={styles.section}>
        <label htmlFor="dashboard-chapter-select" className={styles.sectionTitle}>
          表示する章
        </label>
        <select
          id="dashboard-chapter-select"
          value={chapterId}
          onChange={(e) => setChapterId(e.target.value)}
        >
          {orderedChapterIds.map((id) => {
            const meta = manifest.chapters.find((c) => c.chapterId === id);
            return (
              <option key={id} value={id}>
                {meta?.title ?? id}
              </option>
            );
          })}
        </select>
      </div>

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
        <div className={styles.sectionTitle}>{chapter?.title ?? chapterId}の学習進捗</div>
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

function getSuggestion(
  progress: ReturnType<typeof useChapterProgress>,
  chapterId: string,
): {
  text: string;
  actionLabel: string;
  to?: string;
} {
  if (progress.isLoading) {
    return { text: "読み込み中です…", actionLabel: "読み込み中" };
  }
  if (progress.readSections < progress.totalSections) {
    return {
      text: "この章の教材をまだ最後まで読んでいません。まずは本文に目を通しましょう。",
      actionLabel: "教材を読む",
      to: `/materials/${chapterId}`,
    };
  }
  if (progress.answeredQuestions < progress.totalQuestions) {
    return {
      text: "未回答の問題が残っています。章別ドリルで解いてみましょう。",
      actionLabel: "ドリルを始める",
      to: `/drill?chapter=${chapterId}`,
    };
  }
  if (progress.dueForReviewQuestions > 0) {
    return {
      text: `復習が必要な問題が${progress.dueForReviewQuestions}問あります。誤答フィルタでドリルを実行しましょう。`,
      actionLabel: "ドリルを始める",
      to: `/drill?chapter=${chapterId}`,
    };
  }
  return {
    text: "この章の教材・問題に一通り取り組みました。お疲れさまでした。",
    actionLabel: "ドリルを見直す",
    to: `/drill?chapter=${chapterId}`,
  };
}
