import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import buttonStyles from "../../shared/ui/Button.module.css";
import { getQuestionById } from "../../shared/lib/question-loader";
import { getSection } from "../../shared/lib/content-loader";
import { getQuestionProgress, saveQuestionProgress } from "../../shared/lib/db";
import { applyAnswer } from "../../shared/lib/srs";
import { scoreAnswer } from "../../shared/lib/scoring";
import { buildChoiceOrderMap, getChoiceOrder } from "../../shared/lib/choiceOrder";
import { useDrillSessionStore } from "../../shared/store/drillSessionStore";
import { useQuestionProgress } from "../../shared/hooks/useQuestionProgress";
import styles from "./DrillPlayPage.module.css";

const DIFFICULTY_LABEL: Record<string, string> = {
  basic: "基礎",
  standard: "標準",
  advanced: "応用",
};

export default function DrillPlayPage() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const navigate = useNavigate();

  const questionIds = useDrillSessionStore((s) => s.questionIds);
  const currentIndex = useDrillSessionStore((s) => s.currentIndex);
  const submitAnswer = useDrillSessionStore((s) => s.submitAnswer);
  const goToNext = useDrillSessionStore((s) => s.goToNext);
  const lastFeedback = useDrillSessionStore((s) => s.lastFeedback);
  const sessionChapterId = useDrillSessionStore((s) => s.chapterId);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const questionId = questionIds[currentIndex];
  const question = questionId ? getQuestionById(questionId) : undefined;
  const section = question ? getSection(question.chapterId, question.sectionId) : undefined;
  const answered = lastFeedback !== null && lastFeedback.questionId === questionId;
  const { progress, reload, toggleBookmark } = useQuestionProgress(questionId);

  // 選択肢の表示順はセッション開始時に1回だけ乱数で決め、以後は固定する。
  // 位置（1〜4番目）だけを覚えて正答できてしまうことを防ぐため。
  const choiceOrderMap = useMemo(() => {
    const questions = questionIds
      .map((id) => getQuestionById(id))
      .filter((q): q is NonNullable<typeof q> => q !== undefined);
    return buildChoiceOrderMap(questions);
  }, [questionIds]);
  const choiceOrder = question ? getChoiceOrder(choiceOrderMap, question) : [];

  useEffect(() => {
    setSelectedIndex(null);
  }, [questionId]);

  useEffect(() => {
    if (sessionChapterId !== chapterId || questionIds.length === 0) {
      return;
    }
    if (currentIndex >= questionIds.length) {
      void navigate(`/drill/${chapterId}/result`, { replace: true });
    }
  }, [sessionChapterId, chapterId, questionIds.length, currentIndex, navigate]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!question) return;
      if (!answered) {
        const num = Number.parseInt(e.key, 10);
        if (num >= 1 && num <= question.choices.length) {
          const originalIndex = choiceOrder[num - 1];
          if (originalIndex !== undefined) void handleSelect(originalIndex);
        }
      } else if (e.key === "Enter" || e.key === "ArrowRight") {
        handleNext();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  if (!question || sessionChapterId !== chapterId || questionIds.length === 0) {
    return (
      <div>
        <h1>出題する問題がありません</h1>
        <p>
          <Link to="/drill">ドリル設定に戻る</Link>
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
        問題 {currentIndex + 1} / {questionIds.length} （{DIFFICULTY_LABEL[question.difficulty]}）
      </p>
      <div className={styles.header}>
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
        {choiceOrder.map((originalIndex, displayIndex) => {
          const choice = question.choices[originalIndex]!;
          const isCorrectChoice = originalIndex === question.correctAnswer;
          const isSelected = selectedIndex === originalIndex;
          let className = styles.choiceButton;
          if (answered && isCorrectChoice) className += ` ${styles.choiceCorrect}`;
          if (answered && isSelected && !isCorrectChoice)
            className += ` ${styles.choiceIncorrectSelected}`;

          return (
            <li key={originalIndex}>
              <button
                type="button"
                className={className}
                onClick={() => void handleSelect(originalIndex)}
                disabled={answered}
                aria-pressed={isSelected}
              >
                <span className={styles.choiceKey}>{displayIndex + 1}</span>
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
              {choiceOrder.map((originalIndex) => (
                <li key={originalIndex}>{question.choiceExplanations[originalIndex]}</li>
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
