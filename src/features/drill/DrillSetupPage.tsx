import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import buttonStyles from "../../shared/ui/Button.module.css";
import { getAvailableChapterIds, getChapter, getManifest } from "../../shared/lib/content-loader";
import { filterQuestions, getQuestionById } from "../../shared/lib/question-loader";
import { buildChoiceOrderMap } from "../../shared/lib/choiceOrder";
import { listAllQuestionProgress } from "../../shared/lib/db";
import {
  DEFAULT_DRILL_COUNT,
  DRILL_COUNT_OPTIONS,
  selectDrillQuestionIds,
} from "../../shared/lib/drillSelection";
import { useDrillSessionStore } from "../../shared/store/drillSessionStore";
import type { Difficulty } from "../../entities/question";
import styles from "./DrillSetupPage.module.css";

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: "basic", label: "基礎" },
  { value: "standard", label: "標準" },
  { value: "advanced", label: "応用" },
];

export default function DrillSetupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSectionId = searchParams.get("section") ?? "";
  const initialChapterId = searchParams.get("chapter") ?? "";

  const availableChapterIds = getAvailableChapterIds();
  const manifest = getManifest();
  const orderedChapterIds = manifest.chapters
    .map((c) => c.chapterId)
    .filter((id) => availableChapterIds.includes(id));

  const [chapterId, setChapterId] = useState(
    availableChapterIds.includes(initialChapterId)
      ? initialChapterId
      : (orderedChapterIds[0] ?? ""),
  );
  const chapter = getChapter(chapterId);
  const [selectedDifficulties, setSelectedDifficulties] = useState<Difficulty[]>([
    "basic",
    "standard",
    "advanced",
  ]);
  const [sectionId, setSectionId] = useState(initialSectionId);
  const [randomize, setRandomize] = useState(true);
  // nullは全問
  const [questionCount, setQuestionCount] = useState<number | null>(DEFAULT_DRILL_COUNT);
  const startSession = useDrillSessionStore((s) => s.startSession);

  useEffect(() => {
    setSectionId("");
  }, [chapterId]);

  const matchingQuestions = useMemo(() => {
    const all = filterQuestions({ chapterId, difficulties: selectedDifficulties });
    return sectionId ? all.filter((q) => q.sectionId === sectionId) : all;
  }, [chapterId, selectedDifficulties, sectionId]);

  function toggleDifficulty(value: Difficulty) {
    setSelectedDifficulties((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value],
    );
  }

  async function handleStart() {
    const ids = matchingQuestions.map((q) => q.id);
    const allProgress = await listAllQuestionProgress();
    const progressById = new Map(allProgress.map((p) => [p.questionId, p]));
    const selectedIds = selectDrillQuestionIds(ids, progressById, questionCount, randomize);
    // 選択肢の表示順は開始時に1回だけ決め、読み込み直しても同じ並びを使う。
    // 位置（1〜4番目）だけを覚えて正答できてしまうことを防ぐため。
    const questions = selectedIds
      .map((id) => getQuestionById(id))
      .filter((q): q is NonNullable<typeof q> => q !== undefined);
    startSession(chapterId, selectedIds, buildChoiceOrderMap(questions));
    void navigate(`/drill/${chapterId}/play`);
  }

  return (
    <div>
      <h1>章別ドリル</h1>

      <div className={styles.form}>
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>章</legend>
          <select aria-label="章" value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
            {orderedChapterIds.map((id) => {
              const meta = manifest.chapters.find((c) => c.chapterId === id);
              return (
                <option key={id} value={id}>
                  {meta?.title ?? id}
                </option>
              );
            })}
          </select>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>難易度</legend>
          {DIFFICULTY_OPTIONS.map((opt) => (
            <div key={opt.value} className={styles.checkboxRow}>
              <input
                type="checkbox"
                id={`difficulty-${opt.value}`}
                checked={selectedDifficulties.includes(opt.value)}
                onChange={() => toggleDifficulty(opt.value)}
              />
              <label htmlFor={`difficulty-${opt.value}`}>{opt.label}</label>
            </div>
          ))}
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>節</legend>
          <select aria-label="節" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            <option value="">すべての節</option>
            {chapter?.sections.map((section) => (
              <option key={section.sectionId} value={section.sectionId}>
                {section.title}
              </option>
            ))}
          </select>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>出題数</legend>
          <div className={styles.radioGroup}>
            {[...DRILL_COUNT_OPTIONS, null].map((size) => (
              <div key={size ?? "all"} className={styles.checkboxRow}>
                <input
                  type="radio"
                  id={`count-${size ?? "all"}`}
                  name="questionCount"
                  checked={questionCount === size}
                  onChange={() => setQuestionCount(size)}
                />
                <label htmlFor={`count-${size ?? "all"}`}>{size ? `${size}問` : "全問"}</label>
              </div>
            ))}
          </div>
          <p className={styles.hint}>
            間違えた問題・まだ正解が安定していない問題・未回答の問題の順に優先して選びます。
          </p>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>出題順</legend>
          <div className={styles.checkboxRow}>
            <input
              type="checkbox"
              id="randomize"
              checked={randomize}
              onChange={(e) => setRandomize(e.target.checked)}
            />
            <label htmlFor="randomize">出題順をランダム化する</label>
          </div>
        </fieldset>

        <p className={styles.count}>
          該当する問題: {matchingQuestions.length}問（今回の出題:{" "}
          {questionCount === null
            ? matchingQuestions.length
            : Math.min(questionCount, matchingQuestions.length)}
          問）
        </p>

        <button
          type="button"
          className={buttonStyles.button}
          onClick={() => void handleStart()}
          disabled={matchingQuestions.length === 0}
        >
          ドリルを開始する
        </button>
      </div>
    </div>
  );
}
