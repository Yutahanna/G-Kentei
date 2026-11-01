import type { Question } from "../../entities/question";

/**
 * 1つを選ぶ問題と、当てはまるものをすべて選ぶ問題（answerType: "multiple"）を
 * 同じ形で扱うための共通処理。回答は常に「選んだ選択肢の元インデックスの配列」で表す
 * （1つを選ぶ問題では要素1つ、未回答は空配列）。
 */

export function isMultipleAnswer(question: Question): boolean {
  return question.answerType === "multiple";
}

/** 正解の選択肢の元インデックス（昇順）。 */
export function getCorrectIndices(question: Question): number[] {
  if (isMultipleAnswer(question)) return [...(question.correctAnswers ?? [])].sort((a, b) => a - b);
  return question.correctAnswer === undefined ? [] : [question.correctAnswer];
}

export function isCorrectChoice(question: Question, index: number): boolean {
  return getCorrectIndices(question).includes(index);
}

/** 選んだ組が正解と完全に一致するときだけ正解（部分点なし）。 */
export function isCorrectSelection(question: Question, selected: readonly number[]): boolean {
  const correct = getCorrectIndices(question);
  const chosen = [...new Set(selected)].sort((a, b) => a - b);
  return chosen.length === correct.length && chosen.every((v, i) => v === correct[i]);
}

/** すべて選ぶ問題で、選択肢の選択を切り替えた後の回答。 */
export function toggleSelection(selected: readonly number[], index: number): number[] {
  return selected.includes(index)
    ? selected.filter((i) => i !== index)
    : [...selected, index].sort((a, b) => a - b);
}

/** 選択肢の本文を並べた表示用の文字列（複数のときは「／」で区切る）。 */
export function formatChoices(question: Question, indices: readonly number[]): string {
  return indices.map((i) => question.choices[i] ?? "").join(" ／ ");
}
