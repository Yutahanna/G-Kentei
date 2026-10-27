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

  test("出題数は既定で10問になり、全問を選ぶと章の全問が出る", async ({ page }) => {
    await page.goto("/drill");
    await page.locator("select").first().selectOption("ch05");
    await expect(page.getByText(/該当する問題: 55問（今回の出題: 10問）/)).toBeVisible();
    await page.getByRole("button", { name: "ドリルを開始する" }).click();
    await page.waitForURL("**/drill/ch05/play");
    await expect(page.getByText(/問題 1 \/ 10/)).toBeVisible();

    await page.goto("/drill");
    await page.locator("select").first().selectOption("ch05");
    await page.locator("#count-all").check();
    await expect(page.getByText(/該当する問題: 55問（今回の出題: 55問）/)).toBeVisible();
  });

  test("ブックマークした問題は復習メニューに現れ、復習セッションを完了できる", async ({ page }) => {
    await page.goto("/drill");
    await page.locator("select").first().selectOption("ch06");
    await page.getByRole("button", { name: "ドリルを開始する" }).click();
    await page.waitForURL("**/drill/ch06/play");
    await page.getByRole("button", { name: /ブックマーク/ }).click();
    await expect(page.getByRole("button", { name: "★ ブックマーク済み" })).toBeVisible();

    await page.goto("/review");
    const reviewCard = page.getByText("模試の誤答・ブックマーク", { exact: true }).locator("..");
    await expect(reviewCard.locator('[class*="count"]')).toHaveText(/^[1-9]\d*問$/);
    await reviewCard.getByRole("button", { name: /問で復習を始める/ }).click();

    await page.waitForURL("**/review/play");
    await page.locator('button[class*="choiceButton"]').first().click();
    await page.getByRole("button", { name: /結果を見る|次の問題へ/ }).click();
    await page.waitForURL("**/review/result");
    await expect(page.locator("h1")).toContainText("模試の誤答・ブックマーク復習の結果");
  });

  test("ドリルの途中でページを読み込み直しても、同じ問題・同じ選択肢の並びから再開できる", async ({
    page,
  }) => {
    await page.goto("/drill");
    await page.locator("select").first().selectOption("ch09");
    await page.locator("#count-20").check();
    await page.getByRole("button", { name: "ドリルを開始する" }).click();
    await page.waitForURL("**/drill/ch09/play");

    for (let i = 0; i < 3; i++) {
      await page.locator('button[class*="choiceButton"]').first().click();
      await page.getByRole("button", { name: /次の問題へ/ }).click();
    }
    await expect(page.getByText(/問題 4 \/ 20/)).toBeVisible();
    const heading = await page.locator("h1").first().innerText();
    const choices = await page.locator('button[class*="choiceButton"]').allInnerTexts();

    await page.reload();

    await expect(page.getByText(/問題 4 \/ 20/)).toBeVisible();
    await expect(page.locator("h1").first()).toHaveText(heading);
    expect(await page.locator('button[class*="choiceButton"]').allInnerTexts()).toEqual(choices);

    // 回答直後に読み込み直しても、正誤表示と選んだ選択肢が残る
    await page.locator('button[class*="choiceButton"]').first().click();
    await expect(page.getByText(/正解です|不正解です/)).toBeVisible();
    await page.reload();
    await expect(page.getByText(/正解です|不正解です/)).toBeVisible();
    await expect(page.locator('button[aria-pressed="true"][class*="choiceButton"]')).toHaveCount(1);
  });

  test("復習対象が出題数に足りないときは、ブックマークした問題で補って出題する", async ({
    page,
  }) => {
    await page.goto("/drill");
    await page.locator("select").first().selectOption("ch06");
    await page.getByRole("button", { name: "ドリルを開始する" }).click();
    await page.waitForURL("**/drill/ch06/play");
    await page.getByRole("button", { name: /ブックマーク/ }).click();
    await expect(page.getByRole("button", { name: "★ ブックマーク済み" })).toBeVisible();

    // 誤答が1問もない状態で「直近の回答が誤答の問題」を開くと、ブックマークで補う
    await page.goto("/review");
    const wrongCard = page.getByText("直近の回答が誤答の問題", { exact: true }).locator("..");
    await expect(wrongCard.locator('[class*="count"]')).toHaveText("0問");
    await expect(wrongCard.getByText(/復習対象 0問＋補充 1問/)).toBeVisible();
    await wrongCard.getByRole("button", { name: "1問で始める" }).click();
    await page.waitForURL("**/review/play");
    await expect(page.locator('button[class*="choiceButton"]').first()).toBeVisible();
  });
});
