import type { ExamCompositionConfig } from "../../entities/exam";

/**
 * 模擬試験の教材ベース配分設定（docs/phase0-design.md 8.5節）。
 * 全10章の問題データが完成した時点（2026-08-01）で確定した値。
 *
 * weight は各章の教材節数（content/manifest.jsonのsectionIds件数）を基準にした
 * 「教材内の分量」の代理指標である。minRatio/maxRatioは、素の比率（weight / 全章合計weight）
 * の±40%を基本としつつ、下限5%・上限20%でクリップして極端な偏りを防いでいる。
 * 実際の出題比率はこの範囲内で正規化して決定する（selectExamQuestionIds参照）。
 */
export const EXAM_COMPOSITION_CONFIG: ExamCompositionConfig = {
  version: "1.0.0",
  basis: "content_volume",
  perChapter: [
    { chapterId: "ch01", weight: 5, minRatio: 0.05, maxRatio: 0.099 },
    { chapterId: "ch02", weight: 6, minRatio: 0.051, maxRatio: 0.118 },
    { chapterId: "ch03", weight: 8, minRatio: 0.068, maxRatio: 0.158 },
    { chapterId: "ch04", weight: 7, minRatio: 0.059, maxRatio: 0.138 },
    { chapterId: "ch05", weight: 12, minRatio: 0.101, maxRatio: 0.2 },
    { chapterId: "ch06", weight: 7, minRatio: 0.059, maxRatio: 0.138 },
    { chapterId: "ch07", weight: 6, minRatio: 0.051, maxRatio: 0.118 },
    { chapterId: "ch08", weight: 5, minRatio: 0.05, maxRatio: 0.099 },
    { chapterId: "ch09", weight: 7, minRatio: 0.059, maxRatio: 0.138 },
    { chapterId: "ch10", weight: 8, minRatio: 0.068, maxRatio: 0.158 },
  ],
};
