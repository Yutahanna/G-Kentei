import type { Question, Difficulty } from "../../entities/question";
import { isCorrectSelection } from "./answer";

export interface ExamQuestionResult {
  questionId: string;
  chapterId: string;
  difficulty: Difficulty;
  /** 選んだ選択肢の元インデックス。空配列は未回答。 */
  selected: number[];
  correct: boolean;
}

export interface ExamChapterScore {
  chapterId: string;
  total: number;
  correct: number;
  unanswered: number;
}

export interface ExamScore {
  results: ExamQuestionResult[];
  total: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  accuracy: number; // 0-1、全問題数に対する正答率
  byChapter: ExamChapterScore[];
  byDifficulty: Record<Difficulty, { total: number; correct: number; unanswered: number }>;
}

export function scoreExam(
  questions: Question[],
  answers: Record<string, readonly number[] | undefined>,
): ExamScore {
  const results: ExamQuestionResult[] = questions.map((q) => {
    const selected = [...(answers[q.id] ?? [])];
    return {
      questionId: q.id,
      chapterId: q.chapterId,
      difficulty: q.difficulty,
      selected,
      correct: selected.length > 0 && isCorrectSelection(q, selected),
    };
  });

  const total = results.length;
  const correct = results.filter((r) => r.correct).length;
  const unanswered = results.filter((r) => r.selected.length === 0).length;
  const incorrect = total - correct - unanswered;

  const chapterMap = new Map<string, ExamChapterScore>();
  const difficultyMap: Record<Difficulty, { total: number; correct: number; unanswered: number }> =
    {
      basic: { total: 0, correct: 0, unanswered: 0 },
      standard: { total: 0, correct: 0, unanswered: 0 },
      advanced: { total: 0, correct: 0, unanswered: 0 },
    };

  for (const r of results) {
    const chapterEntry = chapterMap.get(r.chapterId) ?? {
      chapterId: r.chapterId,
      total: 0,
      correct: 0,
      unanswered: 0,
    };
    chapterEntry.total += 1;
    if (r.correct) chapterEntry.correct += 1;
    if (r.selected.length === 0) chapterEntry.unanswered += 1;
    chapterMap.set(r.chapterId, chapterEntry);

    const diffEntry = difficultyMap[r.difficulty];
    diffEntry.total += 1;
    if (r.correct) diffEntry.correct += 1;
    if (r.selected.length === 0) diffEntry.unanswered += 1;
  }

  return {
    results,
    total,
    correct,
    incorrect,
    unanswered,
    accuracy: total === 0 ? 0 : correct / total,
    byChapter: Array.from(chapterMap.values()).sort((a, b) =>
      a.chapterId.localeCompare(b.chapterId),
    ),
    byDifficulty: difficultyMap,
  };
}
