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

    const summary = await page.locator('[class*="summaryValue"]').first().innerText();
    const wrongCount = 20 - Number(summary.split("/")[0]!.trim());

    // 問題ごとに全選択肢（各4つ）と選択肢ごとの説明を表示し、正解に印を付ける
    await expect(page.locator('li[class*="choiceItem"]')).toHaveCount(80);
    await expect(page.locator('li[class*="choiceCorrect"]')).toHaveCount(20);
    await expect(page.locator('[class*="choiceExplanation"]')).toHaveCount(80);
    // 不正解・未回答の問題は最初から開き、正解の問題は折りたたむ
    await expect(page.locator("details[open]")).toHaveCount(wrongCount);

    // 誤答・未回答が復習対象として記録される
    await expect(
      page.getByText(/問を「復習」の模試の誤答・ブックマークに追加しました/),
    ).toBeVisible();

    // 受験履歴に反映され、出題済みの問題数が減る
    await page.getByRole("link", { name: "もう一度模擬試験を行う" }).click();
    await page.waitForURL("/exam");
    await expect(page.getByText("受験履歴")).toBeVisible();
    const unseenText = await page.getByText(/まだ出題されていない問題：/).innerText();
    const [, unseen, total] = /：(\d+) \/ (\d+)/.exec(unseenText)!;
    expect(Number(total) - Number(unseen)).toBe(20);

    await page.goto("/review");
    const reviewCard = page.getByText("模試の誤答・ブックマーク", { exact: true }).locator("..");
    await expect(reviewCard.locator('[class*="count"]')).toHaveText(`${wrongCount}問`);
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

test("結果画面を開き直しても模試の結果を二重に記録しない", async ({ page }) => {
  await page.goto("/exam");
  await page.getByRole("button", { name: /模擬試験を開始する/ }).click();
  await page.waitForURL("**/exam/play");
  for (let i = 0; i < 20; i++) {
    await page.locator('button[class*="choiceButton"]').first().click();
    if (i < 19) await page.getByRole("button", { name: "次の問題へ" }).click();
  }
  await page.getByRole("button", { name: "提出する" }).click();
  await page.waitForURL("**/exam/result");
  await expect(
    page.getByText(/問を「復習」の模試の誤答・ブックマークに追加しました/),
  ).toBeVisible();

  // 別の画面へ移動してから戻る（結果画面が再表示される）
  await page.getByRole("link", { name: "復習" }).first().click();
  await page.waitForURL("**/review");
  await page.goBack();
  await page.waitForURL("**/exam/result");
  await expect(page.locator("h1")).toContainText("模擬試験の結果");

  await page.goto("/exam");
  await expect(page.locator('[class*="historyList"] > li')).toHaveCount(1);
});
