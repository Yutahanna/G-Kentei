import { useCallback, useEffect, useState } from "react";
import { getChapter } from "../lib/content-loader";
import { getQuestionsByChapter } from "../lib/question-loader";
import { getMaterialReadState, getQuestionProgress } from "../lib/db";
import type { Difficulty } from "../../entities/question";
import type { QuestionProgress } from "../../entities/progress";

export interface ChapterProgressSummary {
  isLoading: boolean;
  totalSections: number;
  readSections: number;
  totalQuestions: number;
  answeredQuestions: number;
  correctQuestions: number;
  masteredQuestions: number;
  dueForReviewQuestions: number;
  accuracy: number; // 0-1、回答済み問題に対する正答率（最新の回答結果基準）
  byDifficulty: Record<Difficulty, { total: number; answered: number; correct: number }>;
  reload: () => void;
}

export function useChapterProgress(chapterId: string): ChapterProgressSummary {
  const [isLoading, setIsLoading] = useState(true);
  const [progressByQuestion, setProgressByQuestion] = useState<Record<string, QuestionProgress>>(
    {},
  );
  const [readSectionIds, setReadSectionIds] = useState<Set<string>>(new Set());
  const [version, setVersion] = useState(0);

  const chapter = getChapter(chapterId);
  const questions = getQuestionsByChapter(chapterId);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    async function load() {
      const [progressEntries, readEntries] = await Promise.all([
        Promise.all(questions.map((q) => getQuestionProgress(q.id))),
        Promise.all((chapter?.sections ?? []).map((s) => getMaterialReadState(s.sectionId))),
      ]);
      if (cancelled) return;

      const progressMap: Record<string, QuestionProgress> = {};
      progressEntries.forEach((p) => {
        progressMap[p.questionId] = p;
      });
      setProgressByQuestion(progressMap);

      const readSet = new Set(readEntries.filter((r) => r.readAt !== null).map((r) => r.sectionId));
      setReadSectionIds(readSet);
      setIsLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, version]);

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

  const byDifficulty: ChapterProgressSummary["byDifficulty"] = {
    basic: { total: 0, answered: 0, correct: 0 },
    standard: { total: 0, answered: 0, correct: 0 },
    advanced: { total: 0, answered: 0, correct: 0 },
  };
  for (const q of questions) {
    const bucket = byDifficulty[q.difficulty];
    bucket.total += 1;
    const p = progressByQuestion[q.id];
    if (p && p.attempts > 0) {
      bucket.answered += 1;
      if (isLastAnswerCorrect(q.id)) bucket.correct += 1;
    }
  }

  return {
    isLoading,
    totalSections: chapter?.sections.length ?? 0,
    readSections: readSectionIds.size,
    totalQuestions: questions.length,
    answeredQuestions: answered.length,
    correctQuestions: correct.length,
    masteredQuestions: mastered.length,
    dueForReviewQuestions: dueForReview.length,
    accuracy: answered.length === 0 ? 0 : correct.length / answered.length,
    byDifficulty,
    reload,
  };
}
