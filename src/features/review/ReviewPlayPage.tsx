import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import buttonStyles from "../../shared/ui/Button.module.css";
import { getQuestionById } from "../../shared/lib/question-loader";
import { getChapter, getSection } from "../../shared/lib/content-loader";
import { getQuestionProgress, saveQuestionProgress } from "../../shared/lib/db";
import { applyAnswer } from "../../shared/lib/srs";
import { scoreAnswer } from "../../shared/lib/scoring";
import { useReviewSessionStore } from "../../shared/store/reviewSessionStore";
import { useQuestionProgress } from "../../shared/hooks/useQuestionProgress";
import styles from "../drill/DrillPlayPage.module.css";
import localStyles from "./ReviewPlayPage.module.css";

const DIFFICULTY_LABEL: Record<string, string> = {
  basic: "基礎",
  standard: "標準",
  advanced: "応用",
};

export default function ReviewPlayPage() {
  const navigate = useNavigate();

  const sessionType = useReviewSessionStore((s) => s.sessionType);
  const questionIds = useReviewSessionStore((s) => s.questionIds);
  const currentIndex = useReviewSessionStore((s) => s.currentIndex);
  const submitAnswer = useReviewSessionStore((s) => s.submitAnswer);
  const goToNext = useReviewSessionStore((s) => s.goToNext);
  const lastFeedback = useReviewSessionStore((s) => s.lastFeedback);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const questionId = questionIds[currentIndex];
  const question = questionId ? getQuestionById(questionId) : undefined;
  const chapter = question ? getChapter(question.chapterId) : undefined;
  const section = question ? getSection(question.chapterId, question.sectionId) : undefined;
  const answered = lastFeedback !== null && lastFeedback.questionId === questionId;
  const { progress, reload, toggleBookmark } = useQuestionProgress(questionId);

  useEffect(() => {
    setSelectedIndex(null);
  }, [questionId]);

  useEffect(() => {
    if (sessionType === null || questionIds.length === 0) return;
    if (currentIndex >= questionIds.length) {
      void navigate("/review/result", { replace: true });
    }
  }, [sessionType, questionIds.length, currentIndex, navigate]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!question) return;
      if (!answered) {
        const num = Number.parseInt(e.key, 10);
        if (num >= 1 && num <= question.choices.length) {
          void handleSelect(num - 1);
        }
      } else if (e.key === "Enter" || e.key === "ArrowRight") {
        handleNext();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  if (!question || sessionType === null || questionIds.length === 0) {
    return (
      <div>
        <h1>復習する問題がありません</h1>
        <p>
          <Link to="/review">復習メニューに戻る</Link>
        </p>
      </div>
    );
  }

  async function handleSelect(index: number) {
    if (answered || isSaving || !question) return;
    setSelectedIndex(index);
    setIsSaving(true);
    const result = scoreAnswer(question, index);
    submitAnswer({ questionId: question.id, selectedIndex: index, correct: result.correct });

    const currentProgress = await getQuestionProgress(question.id);
    const next = applyAnswer(currentProgress, result.correct ? "correct" : "incorrect", index);
    await saveQuestionProgress(next);
    reload();
    setIsSaving(false);
  }

  function handleNext() {
    if (!answered) return;
    goToNext();
  }

  return (
    <div>
      <p className={styles.progress}>
        復習 {currentIndex + 1} / {questionIds.length} （{chapter?.title} ・{" "}
        {DIFFICULTY_LABEL[question.difficulty]}）
      </p>
      <div className={localStyles.header}>
        <h1 className={styles.question}>{question.question}</h1>
        <button
          type="button"
          className={buttonStyles.secondary}
          onClick={() => void toggleBookmark()}
          aria-pressed={progress?.bookmarked ?? false}
        >
          {progress?.bookmarked ? "★ ブックマーク済み" : "☆ ブックマーク"}
        </button>
      </div>

      <ul className={styles.choiceList}>
        {question.choices.map((choice, index) => {
          const isCorrectChoice = index === question.correctAnswer;
          const isSelected = selectedIndex === index;
          let className = styles.choiceButton;
          if (answered && isCorrectChoice) className += ` ${styles.choiceCorrect}`;
          if (answered && isSelected && !isCorrectChoice)
            className += ` ${styles.choiceIncorrectSelected}`;

          return (
            <li key={index}>
              <button
                type="button"
                className={className}
                onClick={() => void handleSelect(index)}
                disabled={answered}
                aria-pressed={isSelected}
              >
                <span className={styles.choiceKey}>{index + 1}</span>
                <span>{choice}</span>
                {answered && isCorrectChoice && <span className={styles.mark}>◯ 正解</span>}
                {answered && isSelected && !isCorrectChoice && (
                  <span className={styles.mark}>✕</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {answered && (
        <div
          className={`${styles.feedback} ${lastFeedback?.correct ? styles.feedbackCorrect : styles.feedbackIncorrect}`}
        >
          <div className={styles.feedbackHeading}>
            {lastFeedback?.correct ? "◯ 正解です" : "✕ 不正解です"}
          </div>

          <div className={styles.explanationBlock}>
            <strong>解説</strong>
            <p>{question.explanation}</p>
          </div>

          <div className={styles.explanationBlock}>
            <strong>各選択肢の説明</strong>
            <ol className={styles.choiceExplanationList}>
              {question.choiceExplanations.map((exp, i) => (
                <li key={i}>{exp}</li>
              ))}
            </ol>
          </div>

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

          <div className={styles.actions}>
            <button type="button" className={buttonStyles.button} onClick={handleNext}>
              {currentIndex + 1 >= questionIds.length ? "結果を見る" : "次の問題へ（Enter）"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
