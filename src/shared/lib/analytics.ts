import type { Question, Difficulty, SkillTag } from "../../entities/question";
import type { QuestionProgress } from "../../entities/progress";

/**
 * ダッシュボードの弱点分析で使う集計ロジック。IndexedDBやローダーに依存しない
 * 純粋関数として実装し、Question[]・QuestionProgress[]を受け取って集計するだけにする。
 */

export interface AccuracyStat {
  total: number;
  answered: number;
  correct: number;
  accuracy: number; // 0-1、回答済み問題に対する正答率
}

function emptyStat(): AccuracyStat {
  return { total: 0, answered: 0, correct: 0, accuracy: 0 };
}

function isLastAnswerCorrect(progress: QuestionProgress | undefined): boolean {
  const history = progress?.history ?? [];
  return history[history.length - 1]?.result === "correct";
}

function accumulate(stat: AccuracyStat, progress: QuestionProgress | undefined): void {
  stat.total += 1;
  if (progress && progress.attempts > 0) {
    stat.answered += 1;
    if (isLastAnswerCorrect(progress)) stat.correct += 1;
  }
}

function finalize(stat: AccuracyStat): AccuracyStat {
  return { ...stat, accuracy: stat.answered === 0 ? 0 : stat.correct / stat.answered };
}

export function computeAccuracyByDifficulty(
  questions: Question[],
  progressByQuestion: Record<string, QuestionProgress>,
): Record<Difficulty, AccuracyStat> {
  const stats: Record<Difficulty, AccuracyStat> = {
    basic: emptyStat(),
    standard: emptyStat(),
    advanced: emptyStat(),
  };
  for (const q of questions) {
    accumulate(stats[q.difficulty], progressByQuestion[q.id]);
  }
  return {
    basic: finalize(stats.basic),
    standard: finalize(stats.standard),
    advanced: finalize(stats.advanced),
  };
}

export interface SkillTagAccuracy extends AccuracyStat {
  skillTag: SkillTag;
}

export function computeAccuracyBySkillTag(
  questions: Question[],
  progressByQuestion: Record<string, QuestionProgress>,
): SkillTagAccuracy[] {
  const stats = new Map<SkillTag, AccuracyStat>();
  for (const q of questions) {
    for (const tag of q.tags.skillTags) {
      const stat = stats.get(tag) ?? emptyStat();
      accumulate(stat, progressByQuestion[q.id]);
      stats.set(tag, stat);
    }
  }
  return Array.from(stats.entries())
    .map(([skillTag, stat]) => ({ skillTag, ...finalize(stat) }))
    .sort((a, b) => a.accuracy - b.accuracy);
}

export interface ChapterAccuracy extends AccuracyStat {
  chapterId: string;
  title: string;
}

export function computeAccuracyByChapter(
  questions: Question[],
  progressByQuestion: Record<string, QuestionProgress>,
  chapterTitles: Record<string, string>,
): ChapterAccuracy[] {
  const stats = new Map<string, AccuracyStat>();
  for (const q of questions) {
    const stat = stats.get(q.chapterId) ?? emptyStat();
    accumulate(stat, progressByQuestion[q.id]);
    stats.set(q.chapterId, stat);
  }
  return Array.from(stats.entries())
    .map(([chapterId, stat]) => ({
      chapterId,
      title: chapterTitles[chapterId] ?? chapterId,
      ...finalize(stat),
    }))
    .sort((a, b) => a.chapterId.localeCompare(b.chapterId));
}

export interface SectionAccuracy extends AccuracyStat {
  sectionId: string;
  chapterId: string;
}

export function computeAccuracyBySection(
  questions: Question[],
  progressByQuestion: Record<string, QuestionProgress>,
): SectionAccuracy[] {
  const stats = new Map<string, { chapterId: string; stat: AccuracyStat }>();
  for (const q of questions) {
    const entry = stats.get(q.sectionId) ?? { chapterId: q.chapterId, stat: emptyStat() };
    accumulate(entry.stat, progressByQuestion[q.id]);
    stats.set(q.sectionId, entry);
  }
  return Array.from(stats.entries()).map(([sectionId, { chapterId, stat }]) => ({
    sectionId,
    chapterId,
    ...finalize(stat),
  }));
}

/** 弱点候補: 回答済み問題が一定数以上あり、正答率が閾値を下回るものだけを対象にする。 */
export function selectWeakSections(
  sectionStats: SectionAccuracy[],
  minAnswered = 3,
  maxAccuracy = 0.6,
): SectionAccuracy[] {
  return sectionStats
    .filter((s) => s.answered >= minAnswered && s.accuracy < maxAccuracy)
    .sort((a, b) => a.accuracy - b.accuracy);
}
