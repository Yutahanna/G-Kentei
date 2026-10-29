import { useEffect, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import buttonStyles from "../../shared/ui/Button.module.css";
import { getQuestionById } from "../../shared/lib/question-loader";
import { getChoiceOrder } from "../../shared/lib/choiceOrder";
import { useExamSessionStore, type ExamAnswerState } from "../../shared/store/examSessionStore";
import styles from "./ExamPlayPage.module.css";

/**
 * 模擬試験の受験画面。本試験の受験サイト（JDLA「受験当日の操作マニュアル」Ver12R00）の操作に近づけている。
 * - 上部に残り時間と「試験を終了する」。終了は確認画面を経てから確定する（1回押しただけでは終わらない）。
 * - 問題画面は1問ずつ。「この問題をチェックする」で★を付け、下部の「前の問題へ」「すべての問題を確認する」「次の問題へ」で移動する。
 * - 「すべての問題を確認する」で、問題番号と解答済み・未解答・★の一覧を表示する。
 * - 文字サイズを3段階で変更できる。
 */

type View = "question" | "overview" | "confirm";

const FONT_SIZES = [
  { key: "small", label: "小", scale: 0.9 },
  { key: "medium", label: "中", scale: 1 },
  { key: "large", label: "大", scale: 1.2 },
] as const;
type FontSizeKey = (typeof FONT_SIZES)[number]["key"];
const FONT_SIZE_STORAGE_KEY = "g-kentei-exam-font-size";

function loadFontSize(): FontSizeKey {
  try {
    const saved = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    if (FONT_SIZES.some((f) => f.key === saved)) return saved as FontSizeKey;
  } catch {
    // 保存先が使えない環境では標準の大きさで表示する
  }
  return "medium";
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}分${String(seconds).padStart(2, "0")}秒`;
}

function isAnswered(a: ExamAnswerState | undefined): boolean {
  return a?.selectedIndex !== null && a?.selectedIndex !== undefined;
}

export default function ExamPlayPage() {
  const navigate = useNavigate();
  const questionIds = useExamSessionStore((s) => s.questionIds);
  // 選択肢の表示順はセッション開始時に1回だけ決めてストアに保持する（ExamSetupPage参照）。
  // 前の問題へ戻ったときや結果画面で並びが変わると混乱するため、一貫させる。
  const choiceOrderMap = useExamSessionStore((s) => s.choiceOrderMap);
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
  const [view, setView] = useState<View>("question");
  const [fontSize, setFontSize] = useState<FontSizeKey>(loadFontSize);

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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view, currentIndex]);

  function changeFontSize(key: FontSizeKey) {
    setFontSize(key);
    try {
      localStorage.setItem(FONT_SIZE_STORAGE_KEY, key);
    } catch {
      // 保存できなくても今回の表示には反映する
    }
  }

  function openQuestion(index: number) {
    goTo(index);
    setView("question");
  }

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

  const choiceOrder = getChoiceOrder(choiceOrderMap, question);
  const currentAnswer = answers[questionId];
  const answeredCount = questionIds.filter((id) => isAnswered(answers[id])).length;
  const unansweredCount = questionIds.length - answeredCount;
  const flaggedCount = questionIds.filter((id) => answers[id]?.flagged).length;
  const scale = FONT_SIZES.find((f) => f.key === fontSize)!.scale;

  const finishButton = (
    <button type="button" className={styles.finishButton} onClick={() => submit()}>
      試験を終了する
    </button>
  );

  const questionGrid = (
    <ul className={styles.overviewGrid} aria-label="問題一覧">
      {questionIds.map((id, index) => {
        const a = answers[id];
        const answered = isAnswered(a);
        let className = styles.overviewCell;
        if (answered) className += ` ${styles.overviewAnswered}`;
        if (index === currentIndex) className += ` ${styles.overviewCurrent}`;
        return (
          <li key={id}>
            <button type="button" className={className} onClick={() => openQuestion(index)}>
              {a?.flagged && (
                <span className={styles.star} aria-label="チェックあり">
                  ★
                </span>
              )}
              <span>問題{index + 1}</span>
              <span className={styles.overviewStatus}>{answered ? "解答済" : "未解答"}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className={styles.screen} style={{ "--exam-scale": scale } as CSSProperties}>
      <div className={styles.topBar}>
        <p className={styles.timer} aria-live="off">
          <span aria-hidden="true">⏱</span> 残り時間：
          {remainingMs !== null ? formatRemaining(remainingMs) : "--"}
        </p>
        {view === "confirm" ? (
          finishButton
        ) : (
          <button type="button" className={styles.finishButton} onClick={() => setView("confirm")}>
            試験を終了する
          </button>
        )}
      </div>

      <div className={styles.subBar}>
        <p className={styles.progress}>
          問題 {currentIndex + 1} / {questionIds.length}（回答済み {answeredCount}問）
        </p>
        <div className={styles.fontSizer} role="group" aria-label="文字サイズ変更">
          <span className={styles.fontSizerLabel}>文字サイズ</span>
          {FONT_SIZES.map((f) => (
            <button
              key={f.key}
              type="button"
              className={
                f.key === fontSize
                  ? `${styles.fontSizeButton} ${styles.fontSizeActive}`
                  : styles.fontSizeButton
              }
              onClick={() => changeFontSize(f.key)}
              aria-pressed={f.key === fontSize}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {view === "question" && (
        <>
          <label className={styles.checkLabel}>
            <input
              type="checkbox"
              checked={currentAnswer?.flagged ?? false}
              onChange={() => toggleFlag(questionId)}
            />
            この問題をチェックする
            {currentAnswer?.flagged && <span className={styles.star}>★</span>}
          </label>

          <h1 className={styles.question}>{question.question}</h1>

          <ul className={styles.choiceList}>
            {choiceOrder.map((originalIndex) => {
              const choice = question.choices[originalIndex]!;
              const isSelected = currentAnswer?.selectedIndex === originalIndex;
              return (
                <li key={originalIndex}>
                  <button
                    type="button"
                    className={
                      isSelected
                        ? `${styles.choiceButton} ${styles.choiceSelected}`
                        : styles.choiceButton
                    }
                    onClick={() => selectAnswer(questionId, originalIndex)}
                    aria-pressed={isSelected}
                  >
                    <span className={styles.radio} aria-hidden="true">
                      {isSelected ? "●" : "○"}
                    </span>
                    <span>{choice}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className={styles.navActions}>
            <button
              type="button"
              className={`${buttonStyles.button} ${buttonStyles.secondary}`}
              onClick={() => goTo(currentIndex - 1)}
              disabled={currentIndex === 0}
            >
              前の問題へ
            </button>
            <button
              type="button"
              className={`${buttonStyles.button} ${buttonStyles.secondary}`}
              onClick={() => setView("overview")}
            >
              すべての問題を確認する
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
        </>
      )}

      {view === "overview" && (
        <>
          <div className={styles.centerActions}>
            <button
              type="button"
              className={buttonStyles.button}
              onClick={() => setView("question")}
            >
              解答を続ける
            </button>
          </div>
          <p className={styles.overviewNote}>
            問題番号を押すと、その問題に移動します。チェックした問題には★が付きます。
          </p>
          {questionGrid}
          <div className={styles.centerActions}>
            <button
              type="button"
              className={buttonStyles.button}
              onClick={() => setView("question")}
            >
              解答を続ける
            </button>
          </div>
        </>
      )}

      {view === "confirm" && (
        <>
          <div className={styles.confirmBox} role="alertdialog" aria-label="試験終了の確認">
            <p>試験を終了しますか？</p>
            <p>解答を見直す場合は、下記の一覧から問題をクリックしてください。</p>
            <p className={styles.confirmCounts}>
              未解答 {unansweredCount}問・チェック（★） {flaggedCount}問
            </p>
            <p className={styles.confirmNote}>
              本試験では、終了すると再受験できません。時間切れのときは、それまでの解答で自動的に採点されます。
            </p>
          </div>
          <div className={styles.centerActions}>
            {finishButton}
            <button
              type="button"
              className={`${buttonStyles.button} ${buttonStyles.secondary}`}
              onClick={() => setView("question")}
            >
              解答を続ける
            </button>
          </div>
          {questionGrid}
          <div className={styles.centerActions}>{finishButton}</div>
        </>
      )}
    </div>
  );
}
