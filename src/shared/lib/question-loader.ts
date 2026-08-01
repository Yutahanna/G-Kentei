import ch01Basic from "../../../questions/ch01/basic.json";
import ch01Standard from "../../../questions/ch01/standard.json";
import ch01Advanced from "../../../questions/ch01/advanced.json";
import ch02Basic from "../../../questions/ch02/basic.json";
import ch02Standard from "../../../questions/ch02/standard.json";
import ch02Advanced from "../../../questions/ch02/advanced.json";
import ch03Basic from "../../../questions/ch03/basic.json";
import ch03Standard from "../../../questions/ch03/standard.json";
import ch03Advanced from "../../../questions/ch03/advanced.json";
import ch04Basic from "../../../questions/ch04/basic.json";
import ch04Standard from "../../../questions/ch04/standard.json";
import ch04Advanced from "../../../questions/ch04/advanced.json";
import ch05Basic from "../../../questions/ch05/basic.json";
import ch05Standard from "../../../questions/ch05/standard.json";
import ch05Advanced from "../../../questions/ch05/advanced.json";
import ch06Basic from "../../../questions/ch06/basic.json";
import ch06Standard from "../../../questions/ch06/standard.json";
import ch06Advanced from "../../../questions/ch06/advanced.json";
import ch07Basic from "../../../questions/ch07/basic.json";
import ch07Standard from "../../../questions/ch07/standard.json";
import ch07Advanced from "../../../questions/ch07/advanced.json";
import ch08Basic from "../../../questions/ch08/basic.json";
import ch08Standard from "../../../questions/ch08/standard.json";
import ch08Advanced from "../../../questions/ch08/advanced.json";
import ch09Basic from "../../../questions/ch09/basic.json";
import ch09Standard from "../../../questions/ch09/standard.json";
import ch09Advanced from "../../../questions/ch09/advanced.json";
import ch10Basic from "../../../questions/ch10/basic.json";
import ch10Standard from "../../../questions/ch10/standard.json";
import ch10Advanced from "../../../questions/ch10/advanced.json";
import { questionSchema, type Question, type Difficulty } from "../../schemas/question.schema";

/**
 * questions/ 配下の問題データを読み込む唯一の入り口。
 * 第1章〜第10章、全250問を対象とする。
 */

const allQuestions: Question[] = [
  ...ch01Basic,
  ...ch01Standard,
  ...ch01Advanced,
  ...ch02Basic,
  ...ch02Standard,
  ...ch02Advanced,
  ...ch03Basic,
  ...ch03Standard,
  ...ch03Advanced,
  ...ch04Basic,
  ...ch04Standard,
  ...ch04Advanced,
  ...ch05Basic,
  ...ch05Standard,
  ...ch05Advanced,
  ...ch06Basic,
  ...ch06Standard,
  ...ch06Advanced,
  ...ch07Basic,
  ...ch07Standard,
  ...ch07Advanced,
  ...ch08Basic,
  ...ch08Standard,
  ...ch08Advanced,
  ...ch09Basic,
  ...ch09Standard,
  ...ch09Advanced,
  ...ch10Basic,
  ...ch10Standard,
  ...ch10Advanced,
].map((q) => questionSchema.parse(q));

export function getAllQuestions(): Question[] {
  return allQuestions;
}

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
