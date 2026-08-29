import type { Question } from "../../entities/question";

/**
 * 問題ID -> 選択肢の表示順（choices配列に対する元インデックスの並び）。
 * セッション開始時に1回だけ生成し、同一セッション中は固定する
 * （画面遷移のたびに並びが変わると受験者が混乱するため）。
 */
export type ChoiceOrderMap = Record<string, number[]>;

function shuffledIndices(length: number): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = indices[i]!;
    indices[i] = indices[j]!;
    indices[j] = tmp;
  }
  return indices;
}

/**
 * 与えられた問題群について、選択肢の表示順をランダム化したマップを作る。
 * 正答インデックス自体（question.correctAnswer）は変更しない。表示側が
 * このマップに従って選択肢を並べ替え、クリック時は元インデックスに戻して
 * 採点・進捗保存を行う。
 */
export function buildChoiceOrderMap(questions: Question[]): ChoiceOrderMap {
  const map: ChoiceOrderMap = {};
  for (const question of questions) {
    map[question.id] = shuffledIndices(question.choices.length);
  }
  return map;
}

/** 指定した問題の表示順（未生成の場合は元の並び）を返す。 */
export function getChoiceOrder(map: ChoiceOrderMap, question: Question): number[] {
  return map[question.id] ?? question.choices.map((_, i) => i);
}
