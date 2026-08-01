import { useCallback, useEffect, useState } from "react";
import { getManifest } from "../lib/content-loader";
import { getAllQuestions } from "../lib/question-loader";
import { listAllMaterialReadState, listAllQuestionProgress } from "../lib/db";
import {
  computeAccuracyByChapter,
  computeAccuracyByDifficulty,
  computeAccuracyBySkillTag,
  computeAccuracyBySection,
  selectWeakSections,
  type AccuracyStat,
  type ChapterAccuracy,
  type SkillTagAccuracy,
} from "../lib/analytics";
import type { Difficulty } from "../../entities/question";
import type { QuestionProgress } from "../../entities/progress";

export interface OverallProgressSummary {
  isLoading: boolean;
  totalSections: number;
  readSections: number;
  totalQuestions: number;
  answeredQuestions: number;
  correctQuestions: number;
  masteredQuestions: number;
  dueForReviewQuestions: number;
  accuracy: number;
  byDifficulty: Record<Difficulty, AccuracyStat>;
  byChapter: ChapterAccuracy[];
  bySkillTag: SkillTagAccuracy[];
  weakSections: ReturnType<typeof selectWeakSections>;
  reload: () => void;
}

export function useOverallProgress(): OverallProgressSummary {
  const [isLoading, setIsLoading] = useState(true);
  const [progressByQuestion, setProgressByQuestion] = useState<Record<string, QuestionProgress>>(
    {},
  );
  const [readSectionCount, setReadSectionCount] = useState(0);
  const [version, setVersion] = useState(0);

  const questions = getAllQuestions();
  const manifest = getManifest();
  const totalSections = manifest.chapters.reduce((sum, c) => sum + c.sectionIds.length, 0);
  const chapterTitles = Object.fromEntries(manifest.chapters.map((c) => [c.chapterId, c.title]));

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    async function load() {
      const [progressEntries, readEntries] = await Promise.all([
        listAllQuestionProgress(),
        listAllMaterialReadState(),
      ]);
      if (cancelled) return;

      const progressMap: Record<string, QuestionProgress> = {};
      progressEntries.forEach((p) => {
        progressMap[p.questionId] = p;
      });
      setProgressByQuestion(progressMap);
      setReadSectionCount(readEntries.filter((r) => r.readAt !== null).length);
      setIsLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const isLastAnswerCorrect = (questionId: string): boolean => {
    const history = progressByQuestion[questionId]?.history ?? [];
    return history[history.length - 1]?.result === "correct";
  };

  const answered = questions.filter((q) => (progressByQuestion[q.id]?.attempts ?? 0) > 0);
  const correct = answered.filter((q) => isLastAnswerCorrect(q.id));
  const mastered = questions.filter((q) => progressByQuestion[q.id]?.status === "mastered");
  const dueForReview = questions.filter(
    (q) => progressByQuestion[q.id]?.status === "due_for_review",
  );

  const byDifficultyRaw = computeAccuracyByDifficulty(questions, progressByQuestion);
  const byChapter = computeAccuracyByChapter(questions, progressByQuestion, chapterTitles);
  const bySkillTag = computeAccuracyBySkillTag(questions, progressByQuestion);
  const sectionStats = computeAccuracyBySection(questions, progressByQuestion);
  const weakSections = selectWeakSections(sectionStats);

  return {
    isLoading,
    totalSections,
    readSections: readSectionCount,
    totalQuestions: questions.length,
    answeredQuestions: answered.length,
    correctQuestions: correct.length,
    masteredQuestions: mastered.length,
    dueForReviewQuestions: dueForReview.length,
    accuracy: answered.length === 0 ? 0 : correct.length / answered.length,
    byDifficulty: byDifficultyRaw,
    byChapter,
    bySkillTag,
    weakSections,
    reload,
  };
}
