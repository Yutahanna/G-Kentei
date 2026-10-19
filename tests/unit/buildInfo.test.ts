import { describe, expect, it } from "vitest";
import {
  formatBuildTime,
  getProductionHostForPinnedDeployment,
} from "../../src/shared/lib/buildInfo";

describe("getProductionHostForPinnedDeployment", () => {
  it("デプロイ固定URLから本番ホストを返す", () => {
    expect(getProductionHostForPinnedDeployment("28530173.g-kentei-8fz.pages.dev")).toBe(
      "g-kentei-8fz.pages.dev",
    );
  });

  it("本番URL・独自ドメイン・localhostではnullを返す", () => {
    expect(getProductionHostForPinnedDeployment("g-kentei-8fz.pages.dev")).toBeNull();
    expect(getProductionHostForPinnedDeployment("example.com")).toBeNull();
    expect(getProductionHostForPinnedDeployment("localhost")).toBeNull();
  });
});

describe("formatBuildTime", () => {
  it("日本時間で表示する", () => {
    expect(formatBuildTime("2026-10-12T06:30:00.000Z")).toBe("2026/10/12 15:30");
  });

  it("未設定・不正値は「不明」", () => {
    expect(formatBuildTime("")).toBe("不明");
    expect(formatBuildTime("not-a-date")).toBe("不明");
  });
});
