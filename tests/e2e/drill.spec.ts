import { test, expect } from "@playwright/test";
import { submitIfMultiple } from "./utils/answer";

// 出題はランダムなので、全て選ぶ問題（選んでから「回答する」で採点）に当たることがある。
// その場合は、選択肢を1つ選んだあと「回答する」を押して採点させる（submitIfMultiple）。

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
    await page.locator("#category-chapter").check();
    await expect(page.getByText(/該当する問題: 11問/)).toBeVisible();
    await page.getByRole("button", { name: "ドリルを開始する" }).click();
    await page.waitForURL("**/drill/ch02/play");

    for (let i = 0; i < 10; i++) {
      await page.locator('button[class*="choiceButton"]').first().click();
      await submitIfMultiple(page);
      await expect(page.getByText(/正解です|不正解です/)).toBeVisible();
      await page.getByRole("button", { name: /次の問題へ|結果を見る/ }).click();
    }

    await page.waitForURL("**/drill/ch02/result");
    await expect(page.locator("h1")).toContainText("ドリル結果");
    await expect(page.getByText(/\d+ \/ 10/)).toBeVisible();

    await page.getByRole("link", { name: "ホームに戻る" }).click();
    await page.waitForURL("/");
    await page.selectOption("#dashboard-chapter-select", "ch02");
    await expect(page.getByText("10 / 42", { exact: true })).toBeVisible();
  });

  test("用語確認・計算問題がある章では、問題の種類でその種類だけを選べる", async ({ page }) => {
    await page.goto("/drill");
    await page.locator("select").first().selectOption("ch06");
    await page.locator("#category-term_check").check();
    await expect(page.getByText(/該当する問題: 50問/)).toBeVisible();
    await expect(page.locator("#category-calculation")).toHaveCount(0);
    await page.locator("select").first().selectOption("ch08");
    await page.locator("#category-calculation").check();
    await expect(page.getByText(/該当する問題: 14問/)).toBeVisible();
    // 第8章は2026-11-11から用語確認（度数分布）も持つ
    await expect(page.locator("#category-term_check")).toHaveCount(1);
    await page.locator("select").first().selectOption("ch05");
    await page.locator("#category-principle").check();
    await expect(page.getByText(/該当する問題: 10問/)).toBeVisible();
    await page.locator("select").first().selectOption("ch01");
    await expect(page.locator("#category-calculation")).toHaveCount(0);
    await expect(page.locator("#category-principle")).toHaveCount(0);
  });

  test("原理理解の問題だけを選んで解くと、解説と各選択肢の説明が表示される", async ({ page }) => {
    await page.goto("/drill");
    await page.locator("select").first().selectOption("ch06");
    await page.locator("#category-principle").check();
    await expect(page.getByText(/該当する問題: 3問/)).toBeVisible();
    await page.getByRole("button", { name: "ドリルを開始する" }).click();
    await page.waitForURL("**/drill/ch06/play");
    await page.locator('button[class*="choiceButton"]').first().click();
    await expect(page.getByText(/正解です|不正解です/)).toBeVisible();
    await expect(page.getByText("解説", { exact: true })).toBeVisible();
    await expect(page.getByText("各選択肢の説明")).toBeVisible();
    // 原理理解の問題の解説には、正解の選択肢の理由が「正しい（本問の答え）」として必ず1つ含まれる。
    await expect(page.getByText(/^正しい（本問の答え）。/)).toHaveCount(1);
    await expect(page.getByText(/^教材参照：/)).toBeVisible();
  });

  test("出題数は既定で10問になり、全問を選ぶと章の全問が出る", async ({ page }) => {
    await page.goto("/drill");
    await page.locator("select").first().selectOption("ch05");
    await expect(page.getByText(/該当する問題: 116問（今回の出題: 10問）/)).toBeVisible();
    await page.getByRole("button", { name: "ドリルを開始する" }).click();
    await page.waitForURL("**/drill/ch05/play");
    await expect(page.getByText(/問題 1 \/ 10/)).toBeVisible();

    await page.goto("/drill");
    await page.locator("select").first().selectOption("ch05");
    await page.locator("#count-all").check();
    await expect(page.getByText(/該当する問題: 116問（今回の出題: 116問）/)).toBeVisible();
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
    await submitIfMultiple(page);
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
      await submitIfMultiple(page);
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
    await submitIfMultiple(page);
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

  test("すべて選ぶ問題は複数選んでから「回答する」で採点され、選び漏れが分かる", async ({
    page,
  }) => {
    await page.goto("/drill");
    await page.locator("select").first().selectOption("ch08");
    await page.locator("#difficulty-basic").uncheck();
    await page.locator("#difficulty-advanced").uncheck();
    await page.locator("#count-all").check();
    await page.getByRole("button", { name: "ドリルを開始する" }).click();
    await page.waitForURL("**/drill/ch08/play");

    const choices = page.locator('button[class*="choiceButton"]');
    // 第8章の標準問題には、すべて選ぶ問題が1問含まれる。出題順はランダムなので、現れるまで進める。
    for (let i = 0; i < 20; i++) {
      if (await page.getByText(/すべて選び、「回答する」を押してください/).isVisible()) break;
      await choices.first().click();
      await page.getByRole("button", { name: /次の問題へ|結果を見る/ }).click();
    }
    await expect(choices).toHaveCount(4);
    const submit = page.getByRole("button", { name: /回答する（\d+つ選択中）/ });
    await expect(submit).toBeDisabled();

    // 1つ選んだだけでは採点されず、選択を切り替えられる
    await choices.nth(0).click();
    await expect(page.getByText(/正解です|不正解です/)).toHaveCount(0);
    await choices.nth(1).click();
    await choices.nth(1).click();
    await expect(page.getByRole("button", { name: "回答する（1つ選択中）" })).toBeEnabled();
    await page.getByRole("button", { name: "回答する（1つ選択中）" }).click();

    // 正解は2〜3個なので、1つだけ選んだ回答は不正解になり、選ばなかった正解に「選び漏れ」が付く
    await expect(page.getByText("✕ 不正解です")).toBeVisible();
    await expect(page.getByText(/選び漏れ/).first()).toBeVisible();
  });
});
