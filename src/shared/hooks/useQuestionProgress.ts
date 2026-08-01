import { useCallback, useEffect, useState } from "react";
import { getQuestionProgress, setBookmark } from "../lib/db";
import type { QuestionProgress } from "../../entities/progress";

export interface UseQuestionProgressResult {
  progress: QuestionProgress | null;
  reload: () => void;
  toggleBookmark: () => Promise<void>;
}

export function useQuestionProgress(questionId: string | undefined): UseQuestionProgressResult {
  const [progress, setProgress] = useState<QuestionProgress | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!questionId) {
      setProgress(null);
      return;
    }
    let cancelled = false;
    void getQuestionProgress(questionId).then((p) => {
      if (!cancelled) setProgress(p);
    });
    return () => {
      cancelled = true;
    };
  }, [questionId, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const toggleBookmark = useCallback(async () => {
    if (!questionId || !progress) return;
    const next = !progress.bookmarked;
    await setBookmark(questionId, next);
    setProgress({ ...progress, bookmarked: next });
  }, [questionId, progress]);

  return { progress, reload, toggleBookmark };
}
