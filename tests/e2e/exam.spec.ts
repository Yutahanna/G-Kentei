import { test, expect } from "@playwright/test";

test.describe("模擬試験のゴールデンパス", () => {
  test("20問の模擬試験を最後まで解いて結果画面を確認できる", async ({ page }) => {
    await page.goto("/exam");
    await expect(page.getByText("この配分は本試験の公式配点ではありません")).toBeVisible();
    await page.getByRole("button", { name: /模擬試験を開始する/ }).click();
    await page.waitForURL("**/exam/play");

    for (let i = 0; i < 20; i++) {
      await page.locator('button[class*="choiceButton"]').first().click();
      // 模試中は正誤フィードバックを表示しない
      await expect(page.getByText(/正解です|不正解です/)).toHaveCount(0);
      if (i < 19) {
        await page.getByRole("button", { name: "次の問題へ" }).click();
      }
    }
    await page.getByRole("button", { name: "提出する" }).click();

    await page.waitForURL("**/exam/result");
    await expect(page.locator("h1")).toContainText("模擬試験の結果");
    await expect(page.getByText("教材ベース配分")).toBeVisible();
    await expect(page.locator('[class*="summaryValue"]').first()).toHaveText(/\d+ \/ 20/);

    // 受験履歴に反映される
    await page.getByRole("link", { name: "もう一度模擬試験を行う" }).click();
    await page.waitForURL("/exam");
    await expect(page.getByText("受験履歴")).toBeVisible();
  });

  test("後で確認フラグと問題ジャンプが機能する", async ({ page }) => {
    await page.goto("/exam");
    await page.getByRole("button", { name: /模擬試験を開始する/ }).click();
    await page.waitForURL("**/exam/play");

    await page.getByRole("button", { name: "後で確認する" }).click();
    await expect(page.getByRole("button", { name: /後で確認：オン/ })).toBeVisible();

    await page.locator('button[class*="jumpButton"]').nth(4).click();
    await expect(page.getByText("問題 5 / 20")).toBeVisible();
  });
});
