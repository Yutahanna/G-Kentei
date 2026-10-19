import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import buttonStyles from "../../shared/ui/Button.module.css";
import { getQuestionById } from "../../shared/lib/question-loader";
import { getManifest, getSection } from "../../shared/lib/content-loader";
import {
  getQuestionProgress,
  saveQuestionProgress,
  saveStudySessionLog,
} from "../../shared/lib/db";
import { applyAnswer } from "../../shared/lib/srs";
import { useQuestionProgress } from "../../shared/hooks/useQuestionProgress";
import { scoreExam } from "../../shared/lib/examScoring";
import { useExamSessionStore } from "../../shared/store/examSessionStore";
import styles from "./ExamResultPage.module.css";
import AsOfDateNote from "../../shared/ui/AsOfDateNote";

const DIFFICULTY_LABEL: Record<string, string> = {
  basic: "基礎",
  standard: "標準",
  advanced: "応用",
};

/** 模試の結果画面から、問題を復習対象（ブックマーク）に加える・外す。 */
function BookmarkButton({ questionId, disabled }: { questionId: string; disabled: boolean }) {
  const { progress, toggleBookmark } = useQuestionProgress(disabled ? undefined : questionId);
  return (
    <button
      type="button"
      className={buttonStyles.secondary}
      disabled={disabled || progress === null}
      onClick={() => void toggleBookmark()}
      aria-pressed={progress?.bookmarked ?? false}
    >
      {progress?.bookmarked ? "★ ブックマーク済み" : "☆ ブックマーク"}
    </button>
  );
}

export default function ExamResultPage() {
  const questionIds = useExamSessionStore((s) => s.questionIds);
  const answers = useExamSessionStore((s) => s.answers);
  const isSubmitted = useExamSessionStore((s) => s.isSubmitted);
  const resetSession = useExamSessionStore((s) => s.resetSession);
  const hasSaved = useRef(false);
  const [progressSaved, setProgressSaved] = useState(false);
  const manifest = getManifest();
  const chapterTitles = Object.fromEntries(manifest.chapters.map((c) => [c.chapterId, c.title]));

  const questions = useMemo(
    () => questionIds.map((id) => getQuestionById(id)).filter((q) => q !== undefined),
    [questionIds],
  );
  const answerIndexMap = useMemo(
    () => Object.fromEntries(Object.entries(answers).map(([id, a]) => [id, a.selectedIndex])),
    [answers],
  );
  const score = useMemo(() => scoreExam(questions, answerIndexMap), [questions, answerIndexMap]);

  useEffect(() => {
    if (hasSaved.current || questionIds.length === 0 || !isSubmitted) return;
    hasSaved.current = true;
    const now = new Date().toISOString();
    const chapterIds = Array.from(new Set(questions.map((q) => q.chapterId)));
    void saveStudySessionLog({
      sessionId: `mock-exam-${Date.now()}`,
      type: "mock_exam",
      startedAt: now,
      endedAt: now,
      chapterIds,
      questionIds,
      scoreSummary: { correct: score.correct, total: score.total },
    });
    // 問題ごとの正誤を学習履歴に記録する（誤答・未回答は復習の対象になる）。
    void (async () => {
      const answeredAt = new Date();
      for (const r of score.results) {
        const current = await getQuestionProgress(r.questionId);
        const next = applyAnswer(
          current,
          r.correct ? "correct" : "incorrect",
          r.selectedIndex ?? -1,
          answeredAt,
          "mock_exam",
        );
        await saveQuestionProgress(next);
      }
      setProgressSaved(true);
    })();
  }, [questionIds, isSubmitted, questions, score]);

  if (questionIds.length === 0 || !isSubmitted) {
    return (
      <div>
        <h1>結果がありません</h1>
        <p>
          <Link to="/exam">模擬試験設定に戻る</Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1>模擬試験の結果</h1>
      <p className={styles.disclaimer}>
        出題比率は教材ベース配分（教材の分量に応じた比率）であり、本試験の公式配点ではありません。
      </p>

      <div className={styles.summary}>
        <div>
          <div className={styles.summaryValue}>
            {score.correct} / {score.total}
          </div>
          <div>正答数</div>
        </div>
        <div>
          <div className={styles.summaryValue}>{Math.round(score.accuracy * 100)}%</div>
          <div>正答率</div>
        </div>
        <div>
          <div className={styles.summaryValue}>{score.unanswered}</div>
          <div>未回答</div>
        </div>
      </div>

      <p role="status">
        {progressSaved
          ? `誤答・未回答の${score.total - score.correct}問を「復習」の模試の誤答・ブックマークに追加しました。自信のなかった正解の問題は、下の一覧からブックマークすると復習に加わります。`
          : "結果を学習履歴に記録しています…"}
      </p>

      <h2>章別成績</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>章</th>
            <th>正答 / 出題</th>
            <th>未回答</th>
          </tr>
        </thead>
        <tbody>
          {score.byChapter.map((c) => (
            <tr key={c.chapterId}>
              <td>{chapterTitles[c.chapterId] ?? c.chapterId}</td>
              <td>
                {c.correct} / {c.total}
              </td>
              <td>{c.unanswered}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>難易度別成績</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>難易度</th>
            <th>正答 / 出題</th>
            <th>未回答</th>
          </tr>
        </thead>
        <tbody>
          {(["basic", "standard", "advanced"] as const).map((difficulty) => {
            const stat = score.byDifficulty[difficulty];
            return (
              <tr key={difficulty}>
                <td>{DIFFICULTY_LABEL[difficulty]}</td>
                <td>
                  {stat.correct} / {stat.total}
                </td>
                <td>{stat.unanswered}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2>問題ごとの結果</h2>
      <ul className={styles.list}>
        {score.results.map((r, index) => {
          const question = getQuestionById(r.questionId);
          const label = r.selectedIndex === null ? "未回答" : r.correct ? "正解" : "不正解";
          const labelClass =
            r.selectedIndex === null
              ? styles.unanswered
              : r.correct
                ? styles.correct
                : styles.incorrect;
          const section = question ? getSection(question.chapterId, question.sectionId) : undefined;

          return (
            <li key={r.questionId} className={styles.row}>
              <div className={styles.rowHeader}>
                <span>
                  問題{index + 1}：{question?.question ?? r.questionId}
                </span>
                <span className={labelClass}>{label}</span>
              </div>
              <BookmarkButton questionId={r.questionId} disabled={!progressSaved} />

              {question && (
                <div className={styles.explanationBlock}>
                  {!r.correct && (
                    <p className={styles.answerLine}>
                      <strong>あなたの回答：</strong>
                      {r.selectedIndex === null ? "未回答" : question.choices[r.selectedIndex]}
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
        <Link to="/exam" className={buttonStyles.button} onClick={() => resetSession()}>
          もう一度模擬試験を行う
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
