import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import buttonStyles from "../../shared/ui/Button.module.css";
import Card from "../../shared/ui/Card";
import { getAvailableChapterIds } from "../../shared/lib/content-loader";
import { getQuestionsByChapter } from "../../shared/lib/question-loader";
import { selectExamQuestionIds } from "../../shared/lib/examComposition";
import { EXAM_COMPOSITION_CONFIG } from "../../shared/config/examComposition";
import { listAllStudySessionLogs } from "../../shared/lib/db";
import { useExamSessionStore } from "../../shared/store/examSessionStore";
import type { StudySessionLog } from "../../entities/progress";
import styles from "./ExamSetupPage.module.css";

const PRESETS = [
  { questionCount: 20, timeLimitMinutes: 20, label: "20問（20分）" },
  { questionCount: 50, timeLimitMinutes: 50, label: "50問（50分）" },
  { questionCount: 90, timeLimitMinutes: 90, label: "90問（90分）" },
];

export default function ExamSetupPage() {
  const navigate = useNavigate();
  const startSession = useExamSessionStore((s) => s.startSession);
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [customCount, setCustomCount] = useState(30);
  const [customMinutes, setCustomMinutes] = useState(30);
  const [useCustom, setUseCustom] = useState(false);
  const [history, setHistory] = useState<StudySessionLog[]>([]);

  useEffect(() => {
    void listAllStudySessionLogs().then((logs) => {
      setHistory(
        logs
          .filter((l) => l.type === "mock_exam")
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
      );
    });
  }, []);

  const questionCount = useCustom ? customCount : PRESETS[selectedPreset]!.questionCount;
  const timeLimitMinutes = useCustom ? customMinutes : PRESETS[selectedPreset]!.timeLimitMinutes;

  function handleStart() {
    const chapterIds = getAvailableChapterIds();
    const questionIdsByChapter = Object.fromEntries(
      chapterIds.map((id) => [id, getQuestionsByChapter(id).map((q) => q.id)]),
    );
    const ids = selectExamQuestionIds(questionCount, EXAM_COMPOSITION_CONFIG, questionIdsByChapter);
    startSession(ids, timeLimitMinutes);
    void navigate("/exam/play");
  }

  return (
    <div>
      <h1>模擬試験</h1>
      <p>
        全10章から教材ベース配分（教材の分量に応じた比率）で出題します。この配分は本試験の公式配点ではありません。
      </p>

      <div className={styles.presetGrid}>
        {PRESETS.map((preset, index) => (
          <label key={preset.label} className={styles.presetCard}>
            <input
              type="radio"
              name="preset"
              checked={!useCustom && selectedPreset === index}
              onChange={() => {
                setUseCustom(false);
                setSelectedPreset(index);
              }}
            />
            {preset.label}
          </label>
        ))}
        <label className={styles.presetCard}>
          <input
            type="radio"
            name="preset"
            checked={useCustom}
            onChange={() => setUseCustom(true)}
          />
          カスタム
        </label>
      </div>

      {useCustom && (
        <div className={styles.customForm}>
          <label>
            問題数
            <input
              type="number"
              min={5}
              max={200}
              value={customCount}
              onChange={(e) => setCustomCount(Number(e.target.value))}
            />
          </label>
          <label>
            制限時間（分）
            <input
              type="number"
              min={5}
              max={200}
              value={customMinutes}
              onChange={(e) => setCustomMinutes(Number(e.target.value))}
            />
          </label>
        </div>
      )}

      <button type="button" className={buttonStyles.button} onClick={handleStart}>
        模擬試験を開始する（{questionCount}問・{timeLimitMinutes}分）
      </button>

      {history.length > 0 && (
        <div className={styles.history}>
          <h2>受験履歴</h2>
          <ul className={styles.historyList}>
            {history.map((log) => (
              <li key={log.sessionId}>
                <Card>
                  <div>{new Date(log.startedAt).toLocaleString("ja-JP")}</div>
                  <div className={styles.historyScore}>
                    {log.scoreSummary
                      ? `${log.scoreSummary.correct} / ${log.scoreSummary.total}問正解`
                      : "採点データなし"}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
