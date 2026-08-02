import { test, expect } from "@playwright/test";
import { runAxeAudit } from "./utils/axe";

const ROUTES: { path: string; heading: string }[] = [
  { path: "/", heading: "ホーム" },
  { path: "/materials", heading: "教材" },
  { path: "/materials/ch05", heading: "ディープラーニングの要素技術" },
  { path: "/drill", heading: "章別ドリル" },
  { path: "/review", heading: "復習" },
  { path: "/exam", heading: "模擬試験" },
  { path: "/weak-points", heading: "弱点分析" },
  { path: "/settings", heading: "設定" },
];

test.describe("全ルートのナビゲーションとアクセシビリティ", () => {
  for (const route of ROUTES) {
    test(`${route.path} が正しく表示され、コンソールエラーとWCAG違反がない`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("pageerror", (err) => consoleErrors.push(err.message));

      await page.goto(route.path, { waitUntil: "networkidle" });
      await expect(page.locator("h1")).toContainText(route.heading);
      expect(consoleErrors).toEqual([]);

      const violations = await runAxeAudit(page);
      expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
    });
  }

  test("グローバルナビゲーションの全リンクが遷移する", async ({ page }) => {
    await page.goto("/");
    for (const label of ["教材", "ドリル", "復習", "模擬試験", "設定", "ホーム"]) {
      await page.getByRole("link", { name: label, exact: true }).click();
      await page.waitForLoadState("networkidle");
    }
  });
});
