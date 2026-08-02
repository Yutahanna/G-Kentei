import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";
import { writeTempUploadFile } from "./utils/tmpfile";

test.describe("データのエクスポート・インポート・初期化", () => {
  test("エクスポート→初期化→インポートで学習データが復元される", async ({ page }, testInfo) => {
    await page.goto("/drill");
    await page.locator("select").first().selectOption("ch04");
    await page.getByRole("button", { name: "ドリルを開始する" }).click();
    await page.waitForURL("**/drill/ch04/play");
    await page.locator('button[class*="choiceButton"]').first().click();

    await page.goto("/settings");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "データをエクスポートする" }).click();
    const download = await downloadPromise;
    const exportPath = writeTempUploadFile(`backup-${testInfo.testId}.json`, {});
    await download.saveAs(exportPath);

    const exported = JSON.parse(readFileSync(exportPath, "utf-8")) as {
      questionProgress: { questionId: string }[];
    };
    expect(exported.questionProgress.some((p) => p.questionId.startsWith("ch04-"))).toBe(true);

    page.on("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "データを初期化する" }).click();
    await expect(page.getByText("初期化しました")).toBeVisible();

    await page.setInputFiles('input[type="file"]', exportPath);
    await expect(page.getByText("インポートしました")).toBeVisible();

    await page.reload();
    await page.goto("/");
    await page.selectOption("#dashboard-chapter-select", "ch04");
    await expect(page.getByText("1 / 25", { exact: true })).toBeVisible();
  });

  test("不正な形式のファイルをインポートするとエラーになり、データは変更されない", async ({
    page,
  }, testInfo) => {
    const badFilePath = writeTempUploadFile(`bad-${testInfo.testId}.json`, { foo: "bar" });

    await page.goto("/settings");
    await page.setInputFiles('input[type="file"]', badFilePath);
    await expect(page.getByText("ファイルの内容がバックアップデータの形式と一致しません")).toBeVisible();
  });
});
