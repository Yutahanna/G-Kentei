import ch01Basic from "../../../questions/ch01/basic.json";
import ch01Standard from "../../../questions/ch01/standard.json";
import ch01Advanced from "../../../questions/ch01/advanced.json";
import { questionSchema, type Question, type Difficulty } from "../../schemas/question.schema";

/**
 * questions/ 配下の問題データを読み込む唯一の入り口。
 * フェーズ1では第1章25問のみを対象とする。
 */

const allQuestions: Question[] = [...ch01Basic, ...ch01Standard, ...ch01Advanced].map((q) =>
  questionSchema.parse(q),
);

export function getQuestionsByChapter(chapterId: string): Question[] {
  return allQuestions.filter((q) => q.chapterId === chapterId);
}

export function getQuestionsBySection(sectionId: string): Question[] {
  return allQuestions.filter((q) => q.sectionId === sectionId);
}

export function getQuestionById(id: string): Question | undefined {
  return allQuestions.find((q) => q.id === id);
}

export function filterQuestions(options: {
  chapterId?: string;
  difficulties?: Difficulty[];
}): Question[] {
  return allQuestions.filter((q) => {
    if (options.chapterId && q.chapterId !== options.chapterId) return false;
    if (options.difficulties && !options.difficulties.includes(q.difficulty)) return false;
    return true;
  });
}
