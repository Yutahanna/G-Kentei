import { test, expect } from "@playwright/test";

test.describe("章別ドリルのゴールデンパス", () => {
  test("教材を読む→ドリルを解く→結果画面→ホームに進捗が反映される", async ({ page }) => {
    await page.goto("/materials/ch02");
    await page
      .getByRole("button", { name: /既読にする|読了/ })
      .first()
      .click();

    await page.goto("/drill");
    await page.locator("select").first().selectOption("ch02");
    await page.locator("#difficulty-standard").uncheck();
    await page.locator("#difficulty-advanced").uncheck();
    await expect(page.getByText(/該当する問題: 10問/)).toBeVisible();
    await page.getByRole("button", { name: "ドリルを開始する" }).click();
    await page.waitForURL("**/drill/ch02/play");

    for (let i = 0; i < 10; i++) {
      await page.locator('button[class*="choiceButton"]').first().click();
      await expect(page.getByText(/正解です|不正解です/)).toBeVisible();
      await page.getByRole("button", { name: /次の問題へ|結果を見る/ }).click();
    }

    await page.waitForURL("**/drill/ch02/result");
    await expect(page.locator("h1")).toContainText("ドリル結果");
    await expect(page.getByText(/\d+ \/ 10/)).toBeVisible();

    await page.getByRole("link", { name: "ホームに戻る" }).click();
    await page.waitForURL("/");
    await page.selectOption("#dashboard-chapter-select", "ch02");
    await expect(page.getByText("10 / 25", { exact: true })).toBeVisible();
  });

  test("ブックマークした問題は復習メニューに現れ、復習セッションを完了できる", async ({ page }) => {
    await page.goto("/drill");
    await page.locator("select").first().selectOption("ch06");
    await page.getByRole("button", { name: "ドリルを開始する" }).click();
    await page.waitForURL("**/drill/ch06/play");
    await page.getByRole("button", { name: /ブックマーク/ }).click();
    await expect(page.getByRole("button", { name: "★ ブックマーク済み" })).toBeVisible();

    await page.goto("/review");
    const bookmarkCard = page.getByText("ブックマークした問題").locator("..");
    await expect(bookmarkCard.getByText(/[1-9]\d*問/)).toBeVisible();
    await bookmarkCard.getByRole("button", { name: "この復習を始める" }).click();

    await page.waitForURL("**/review/play");
    await page.locator('button[class*="choiceButton"]').first().click();
    await page.getByRole("button", { name: /結果を見る|次の問題へ/ }).click();
    await page.waitForURL("**/review/result");
    await expect(page.locator("h1")).toContainText("ブックマーク復習の結果");
  });
});
