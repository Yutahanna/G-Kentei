import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import type { Page } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const axeSource = readFileSync(
  join(__dirname, "../../../node_modules/axe-core/axe.min.js"),
  "utf-8",
);

export interface AxeViolation {
  id: string;
  impact: string | null;
  description: string;
  nodes: { target: string[] }[];
}

interface AxeGlobal {
  axe: { run: (context: Document, options: unknown) => Promise<{ violations: AxeViolation[] }> };
}

/** 現在のページに対してWCAG 2 A/AA観点のaxe-core監査を実行し、違反一覧を返す。 */
export async function runAxeAudit(page: Page): Promise<AxeViolation[]> {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async () => {
    const { axe } = window as unknown as AxeGlobal;
    const results = await axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
    });
    return results.violations;
  });
}
