import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import buttonStyles from "../../shared/ui/Button.module.css";
import { getQuestionById } from "../../shared/lib/question-loader";
import { useExamSessionStore } from "../../shared/store/examSessionStore";
import styles from "./ExamPlayPage.module.css";

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function ExamPlayPage() {
  const navigate = useNavigate();
  const questionIds = useExamSessionStore((s) => s.questionIds);
  const answers = useExamSessionStore((s) => s.answers);
  const currentIndex = useExamSessionStore((s) => s.currentIndex);
  const timeLimitMinutes = useExamSessionStore((s) => s.timeLimitMinutes);
  const startedAt = useExamSessionStore((s) => s.startedAt);
  const isSubmitted = useExamSessionStore((s) => s.isSubmitted);
  const selectAnswer = useExamSessionStore((s) => s.selectAnswer);
  const toggleFlag = useExamSessionStore((s) => s.toggleFlag);
  const goTo = useExamSessionStore((s) => s.goTo);
  const submit = useExamSessionStore((s) => s.submit);

  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    if (!startedAt || questionIds.length === 0 || isSubmitted) return;
    const deadline = new Date(startedAt).getTime() + timeLimitMinutes * 60 * 1000;
    function tick() {
      const remaining = deadline - Date.now();
      setRemainingMs(remaining);
      if (remaining <= 0) {
        submit();
      }
    }
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [startedAt, timeLimitMinutes, questionIds.length, isSubmitted, submit]);

  useEffect(() => {
    if (isSubmitted) {
      void navigate("/exam/result", { replace: true });
    }
  }, [isSubmitted, navigate]);

  if (questionIds.length === 0) {
    return (
      <div>
        <h1>受験中の模擬試験がありません</h1>
        <p>
          <Link to="/exam">模擬試験設定に戻る</Link>
        </p>
      </div>
    );
  }

  const questionId = questionIds[currentIndex];
  const question = questionId ? getQuestionById(questionId) : undefined;
  if (!question || !questionId) return null;

  const currentAnswer = answers[questionId];
  const answeredCount = Object.values(answers).filter((a) => a.selectedIndex !== null).length;

  return (
    <div>
      <div className={styles.header}>
        <p className={styles.progress}>
          問題 {currentIndex + 1} / {questionIds.length}（回答済み {answeredCount}問）
        </p>
        {remainingMs !== null && (
          <p className={styles.timer} aria-live="polite">
            残り時間 {formatRemaining(remainingMs)}
          </p>
        )}
        <button type="button" className={buttonStyles.button} onClick={() => submit()}>
          提出する
        </button>
      </div>

      <div className={styles.jumpGrid}>
        {questionIds.map((id, index) => {
          const a = answers[id];
          let className = styles.jumpButton;
          if (index === currentIndex) className += ` ${styles.jumpCurrent}`;
          else if (a?.selectedIndex !== null && a?.selectedIndex !== undefined)
            className += ` ${styles.jumpAnswered}`;
          if (a?.flagged) className += ` ${styles.jumpFlagged}`;
          return (
            <button
              key={id}
              type="button"
              className={className}
              onClick={() => goTo(index)}
              aria-current={index === currentIndex}
            >
              {index + 1}
            </button>
          );
        })}
      </div>

      <div className={styles.questionHeader}>
        <h1 className={styles.question}>{question.question}</h1>
        <button
          type="button"
          className={buttonStyles.secondary}
          onClick={() => toggleFlag(questionId)}
          aria-pressed={currentAnswer?.flagged ?? false}
        >
          {currentAnswer?.flagged ? "🚩 後で確認：オン" : "後で確認する"}
        </button>
      </div>

      <ul className={styles.choiceList}>
        {question.choices.map((choice, index) => {
          const isSelected = currentAnswer?.selectedIndex === index;
          return (
            <li key={index}>
              <button
                type="button"
                className={isSelected ? `${styles.choiceButton} ${styles.choiceSelected}` : styles.choiceButton}
                onClick={() => selectAnswer(questionId, index)}
                aria-pressed={isSelected}
              >
                <span className={styles.choiceKey}>{index + 1}</span>
                <span>{choice}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className={styles.navActions}>
        <button
          type="button"
          className={buttonStyles.secondary}
          onClick={() => goTo(currentIndex - 1)}
          disabled={currentIndex === 0}
        >
          前の問題へ
        </button>
        <button
          type="button"
          className={buttonStyles.button}
          onClick={() => goTo(currentIndex + 1)}
          disabled={currentIndex >= questionIds.length - 1}
        >
          次の問題へ
        </button>
      </div>
    </div>
  );
}
