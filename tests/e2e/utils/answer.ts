import type { Page } from "@playwright/test";

// 「すべて選ぶ」問題（answerType: "multiple"）は、選択肢を選んだあと「回答する」を押すまで採点されない。
export async function submitIfMultiple(page: Page) {
  const submit = page.getByRole("button", { name: /回答する（\d+つ選択中）/ });
  if (await submit.isVisible()) await submit.click();
}
