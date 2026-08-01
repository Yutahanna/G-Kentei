import { describe, expect, it } from "vitest";
import { exportedDataSchema } from "../../src/schemas/progress.schema";
import { createInitialProgress, DEFAULT_USER_SETTINGS } from "../../src/entities/progress";

describe("progress.schema（エクスポート/インポートデータの検証）", () => {
  it("exportAllDataが返す形の正常なデータを受け入れる", () => {
    const data = {
      exportedAt: "2026-08-01T00:00:00.000Z",
      questionProgress: [createInitialProgress("ch01-basic-001")],
      studySessionLog: [
        {
          sessionId: "drill-1",
          type: "drill" as const,
          startedAt: "2026-08-01T00:00:00.000Z",
          endedAt: "2026-08-01T00:10:00.000Z",
          chapterIds: ["ch01"],
          questionIds: ["ch01-basic-001"],
          scoreSummary: { correct: 1, total: 1 },
        },
      ],
      materialReadState: [{ sectionId: "ch01-s01", readAt: "2026-08-01T00:00:00.000Z" }],
      userSettings: DEFAULT_USER_SETTINGS,
    };
    const result = exportedDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("不正な形式のデータ（構造が異なるJSON）は拒否する", () => {
    const result = exportedDataSchema.safeParse({ foo: "bar" });
    expect(result.success).toBe(false);
  });

  it("questionProgressのstatusが不正な値なら拒否する", () => {
    const data = {
      exportedAt: "2026-08-01T00:00:00.000Z",
      questionProgress: [{ ...createInitialProgress("q1"), status: "invalid_status" }],
      studySessionLog: [],
      materialReadState: [],
      userSettings: DEFAULT_USER_SETTINGS,
    };
    const result = exportedDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
