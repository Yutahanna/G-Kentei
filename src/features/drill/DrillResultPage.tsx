import { useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import buttonStyles from "../../shared/ui/Button.module.css";
import { getQuestionById } from "../../shared/lib/question-loader";
import { saveStudySessionLog } from "../../shared/lib/db";
import { summarizeDrillResults } from "../../shared/lib/scoring";
import { useDrillSessionStore } from "../../shared/store/drillSessionStore";
import styles from "./DrillResultPage.module.css";

export default function DrillResultPage() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const answers = useDrillSessionStore((s) => s.answers);
  const sessionChapterId = useDrillSessionStore((s) => s.chapterId);
  const resetSession = useDrillSessionStore((s) => s.resetSession);
  const hasSaved = useRef(false);

  useEffect(() => {
    if (hasSaved.current || answers.length === 0 || sessionChapterId !== chapterId) return;
    hasSaved.current = true;
    const now = new Date().toISOString();
    void saveStudySessionLog({
      sessionId: `drill-${Date.now()}`,
      type: "drill",
      startedAt: now,
      endedAt: now,
      chapterIds: chapterId ? [chapterId] : [],
      questionIds: answers.map((a) => a.questionId),
      scoreSummary: {
        correct: answers.filter((a) => a.correct).length,
        total: answers.length,
      },
    });
  }, [answers, sessionChapterId, chapterId]);

  if (answers.length === 0 || sessionChapterId !== chapterId) {
    return (
      <div>
        <h1>結果がありません</h1>
        <p>
          <Link to="/drill">ドリル設定に戻る</Link>
        </p>
      </div>
    );
  }

  const summary = summarizeDrillResults(
    answers.map((a) => ({ correct: a.correct, selectedIndex: a.selectedIndex, correctAnswer: -1 })),
  );

  return (
    <div>
      <h1>ドリル結果</h1>

      <div className={styles.summary}>
        <div>
          <div className={styles.summaryValue}>
            {summary.correctCount} / {summary.total}
          </div>
          <div>正答数</div>
        </div>
        <div>
          <div className={styles.summaryValue}>{Math.round(summary.accuracy * 100)}%</div>
          <div>正答率</div>
        </div>
      </div>

      <h2>問題ごとの結果</h2>
      <ul className={styles.list}>
        {answers.map((answer, index) => {
          const question = getQuestionById(answer.questionId);
          return (
            <li key={answer.questionId} className={styles.row}>
              <span>
                問題{index + 1}：{question?.question ?? answer.questionId}
              </span>
              <span className={answer.correct ? styles.correct : styles.incorrect}>
                {answer.correct ? "正解" : "不正解"}
              </span>
            </li>
          );
        })}
      </ul>

      <div className={styles.actions}>
        <Link to="/drill" className={buttonStyles.button} onClick={() => resetSession()}>
          もう一度ドリルを行う
        </Link>
        <Link
          to="/"
          className={`${buttonStyles.button} ${buttonStyles.secondary}`}
          onClick={() => resetSession()}
        >
          ホームに戻る
        </Link>
      </div>
    </div>
  );
}
