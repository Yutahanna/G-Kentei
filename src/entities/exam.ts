/**
 * 模擬試験の出題比率設定。docs/phase0-design.md 8.5節で確定した型定義に対応する。
 * basisは常に"content_volume"（教材ベース配分）とし、公式シラバスの配点を装わない。
 */
export interface ExamChapterWeight {
  chapterId: string;
  weight: number; // 相対重み（章の節数など、教材内の分量を基準にする）
  minRatio: number; // 出題比率の下限（極端な偏り防止）
  maxRatio: number; // 出題比率の上限
}

export interface ExamCompositionConfig {
  version: string;
  basis: "content_volume";
  perChapter: ExamChapterWeight[];
}
