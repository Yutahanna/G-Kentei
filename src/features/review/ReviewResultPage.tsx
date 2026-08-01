import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import buttonStyles from "../../shared/ui/Button.module.css";
import { getQuestionById } from "../../shared/lib/question-loader";
import { saveStudySessionLog } from "../../shared/lib/db";
import { summarizeDrillResults } from "../../shared/lib/scoring";
import { useReviewSessionStore } from "../../shared/store/reviewSessionStore";
import styles from "../drill/DrillResultPage.module.css";

const SESSION_TYPE_LABEL: Record<string, string> = {
  due_for_review: "SRS復習",
  wrong_answer: "誤答復習",
  bookmarked: "ブックマーク復習",
};

export default function ReviewResultPage() {
  const answers = useReviewSessionStore((s) => s.answers);
  const sessionType = useReviewSessionStore((s) => s.sessionType);
  const resetSession = useReviewSessionStore((s) => s.resetSession);
  const hasSaved = useRef(false);

  useEffect(() => {
    if (hasSaved.current || answers.length === 0 || sessionType === null) return;
    hasSaved.current = true;
    const now = new Date().toISOString();
    const chapterIds = Array.from(
      new Set(
        answers
          .map((a) => getQuestionById(a.questionId)?.chapterId)
          .filter((id): id is string => id !== undefined),
      ),
    );
    void saveStudySessionLog({
      sessionId: `review-${Date.now()}`,
      type: "review",
      startedAt: now,
      endedAt: now,
      chapterIds,
      questionIds: answers.map((a) => a.questionId),
      scoreSummary: {
        correct: answers.filter((a) => a.correct).length,
        total: answers.length,
      },
    });
  }, [answers, sessionType]);

  if (answers.length === 0 || sessionType === null) {
    return (
      <div>
        <h1>結果がありません</h1>
        <p>
          <Link to="/review">復習メニューに戻る</Link>
        </p>
      </div>
    );
  }

  const summary = summarizeDrillResults(
    answers.map((a) => ({ correct: a.correct, selectedIndex: a.selectedIndex, correctAnswer: -1 })),
  );

  return (
    <div>
      <h1>{SESSION_TYPE_LABEL[sessionType]}の結果</h1>

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
        <Link to="/review" className={buttonStyles.button} onClick={() => resetSession()}>
          復習メニューに戻る
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
