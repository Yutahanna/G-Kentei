import { useEffect } from "react";
import { Link } from "react-router-dom";
import buttonStyles from "../../shared/ui/Button.module.css";
import { getQuestionById } from "../../shared/lib/question-loader";
import { getSection } from "../../shared/lib/content-loader";
import { saveStudySessionLog } from "../../shared/lib/db";
import { summarizeDrillResults } from "../../shared/lib/scoring";
import { useReviewSessionStore } from "../../shared/store/reviewSessionStore";
import styles from "../drill/DrillResultPage.module.css";
import AsOfDateNote from "../../shared/ui/AsOfDateNote";

const SESSION_TYPE_LABEL: Record<string, string> = {
  mock_review: "模試の誤答・ブックマーク復習",
  due_for_review: "SRS復習",
  wrong_answer: "誤答復習",
  bookmarked: "ブックマーク復習",
};

export default function ReviewResultPage() {
  const answers = useReviewSessionStore((s) => s.answers);
  const sessionType = useReviewSessionStore((s) => s.sessionType);
  const resetSession = useReviewSessionStore((s) => s.resetSession);
  const isRecorded = useReviewSessionStore((s) => s.isRecorded);
  const markRecorded = useReviewSessionStore((s) => s.markRecorded);

  useEffect(() => {
    if (isRecorded || answers.length === 0 || sessionType === null) return;
    markRecorded();
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
  }, [answers, sessionType, isRecorded, markRecorded]);

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
          const section = question ? getSection(question.chapterId, question.sectionId) : undefined;

          return (
            <li key={answer.questionId} className={styles.row}>
              <div className={styles.rowHeader}>
                <span>
                  問題{index + 1}：{question?.question ?? answer.questionId}
                </span>
                <span className={answer.correct ? styles.correct : styles.incorrect}>
                  {answer.correct ? "正解" : "不正解"}
                </span>
              </div>

              {question && (
                <div className={styles.explanationBlock}>
                  {!answer.correct && (
                    <p className={styles.answerLine}>
                      <strong>あなたの回答：</strong>
                      {question.choices[answer.selectedIndex]}
                    </p>
                  )}
                  <p className={styles.answerLine}>
                    <strong>正解：</strong>
                    {question.choices[question.correctAnswer]}
                  </p>
                  <p>
                    <strong>解説</strong>
                  </p>
                  <p>{question.explanation}</p>
                  <AsOfDateNote asOfDate={question.asOfDate} />
                  <p className={styles.sourceRef}>
                    教材参照：{question.sourceReference}
                    {section && (
                      <>
                        {" "}
                        <Link to={`/materials/${question.chapterId}#${section.sectionId}`}>
                          教材の該当節を見る
                        </Link>
                      </>
                    )}
                  </p>
                </div>
              )}
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
