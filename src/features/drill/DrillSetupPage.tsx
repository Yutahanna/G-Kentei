import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import buttonStyles from "../../shared/ui/Button.module.css";
import { getAvailableChapterIds, getChapter, getManifest } from "../../shared/lib/content-loader";
import { filterQuestions } from "../../shared/lib/question-loader";
import { useDrillSessionStore } from "../../shared/store/drillSessionStore";
import type { Difficulty } from "../../entities/question";
import styles from "./DrillSetupPage.module.css";

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: "basic", label: "基礎" },
  { value: "standard", label: "標準" },
  { value: "advanced", label: "応用" },
];

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

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

  function handleStart() {
    const ids = matchingQuestions.map((q) => q.id);
    const ordered = randomize ? shuffle(ids) : ids;
    startSession(chapterId, ordered);
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

        <p className={styles.count}>該当する問題: {matchingQuestions.length}問</p>

        <button
          type="button"
          className={buttonStyles.button}
          onClick={handleStart}
          disabled={matchingQuestions.length === 0}
        >
          ドリルを開始する
        </button>
      </div>
    </div>
  );
}
