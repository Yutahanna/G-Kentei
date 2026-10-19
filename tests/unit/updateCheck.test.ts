import { describe, expect, it } from "vitest";
import { judgeUpdateStatus } from "../../src/shared/lib/updateCheck";

const ok = { type: "basic", ok: true, status: 200 } as const;

describe("judgeUpdateStatus", () => {
  it("リダイレクト（ログイン期限切れ）はauth-expired", () => {
    expect(
      judgeUpdateStatus({ type: "opaqueredirect", ok: false, status: 0 }, undefined, "a"),
    ).toBe("auth-expired");
    expect(judgeUpdateStatus({ type: "basic", ok: false, status: 403 }, undefined, "a")).toBe(
      "auth-expired",
    );
  });

  it("配信中のコミットが異なればupdate-available、同じならup-to-date", () => {
    expect(judgeUpdateStatus(ok, "new", "old")).toBe("update-available");
    expect(judgeUpdateStatus(ok, "same", "same")).toBe("up-to-date");
  });

  it("判定材料が無ければunknown", () => {
    expect(judgeUpdateStatus(ok, undefined, "a")).toBe("unknown");
    expect(judgeUpdateStatus(ok, "a", "")).toBe("unknown");
    expect(judgeUpdateStatus({ type: "basic", ok: false, status: 404 }, undefined, "a")).toBe(
      "unknown",
    );
  });
});
