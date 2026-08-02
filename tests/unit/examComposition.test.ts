import { describe, expect, it } from "vitest";
import {
  allocateExamQuestionCounts,
  selectExamQuestionIds,
} from "../../src/shared/lib/examComposition";
import { EXAM_COMPOSITION_CONFIG } from "../../src/shared/config/examComposition";
import type { ExamCompositionConfig } from "../../src/entities/exam";

function makeIds(chapterId: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${chapterId}-q${i}`);
}

describe("examComposition（模擬試験の出題配分）", () => {
  it("実際の設定値・全10章25問ずつの構成で、合計が指定数と一致する", () => {
    const availableByChapter = Object.fromEntries(
      EXAM_COMPOSITION_CONFIG.perChapter.map((c) => [c.chapterId, 25]),
    );
    for (const totalCount of [10, 20, 50, 90, 200]) {
      const counts = allocateExamQuestionCounts(
        totalCount,
        EXAM_COMPOSITION_CONFIG,
        availableByChapter,
      );
      const sum = Object.values(counts).reduce((a, b) => a + b, 0);
      expect(sum).toBe(totalCount);
      for (const [chapterId, count] of Object.entries(counts)) {
        expect(count).toBeLessThanOrEqual(availableByChapter[chapterId]!);
        expect(count).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("均等な重みでは、章ごとの配分がほぼ均等になる", () => {
    const config: ExamCompositionConfig = {
      version: "test",
      basis: "content_volume",
      perChapter: [
        { chapterId: "chA", weight: 1, minRatio: 0.2, maxRatio: 0.8 },
        { chapterId: "chB", weight: 1, minRatio: 0.2, maxRatio: 0.8 },
      ],
    };
    const counts = allocateExamQuestionCounts(10, config, { chA: 25, chB: 25 });
    expect(counts.chA).toBe(5);
    expect(counts.chB).toBe(5);
  });

  it("保有数が少ない章は上限でキャップされ、超過分が他章へ再配分される", () => {
    const config: ExamCompositionConfig = {
      version: "test",
      basis: "content_volume",
      perChapter: [
        { chapterId: "chA", weight: 1, minRatio: 0.3, maxRatio: 0.7 },
        { chapterId: "chB", weight: 1, minRatio: 0.3, maxRatio: 0.7 },
      ],
    };
    const counts = allocateExamQuestionCounts(10, config, { chA: 2, chB: 25 });
    expect(counts.chA).toBe(2);
    expect(counts.chB).toBe(8);
  });

  it("selectExamQuestionIdsは重複なく指定数の問題IDを選ぶ", () => {
    const questionIdsByChapter = Object.fromEntries(
      EXAM_COMPOSITION_CONFIG.perChapter.map((c) => [c.chapterId, makeIds(c.chapterId, 25)]),
    );
    let seed = 42;
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const ids = selectExamQuestionIds(50, EXAM_COMPOSITION_CONFIG, questionIdsByChapter, random);
    expect(ids).toHaveLength(50);
    expect(new Set(ids).size).toBe(50);
  });
});
