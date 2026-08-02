import { existsSync } from "fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * E2Eテスト設定。本番相当のビルド（vite preview）に対して実行する。
 *
 * サンドボックス環境ではブラウザ本体が /opt/pw-browsers に事前配置されているため、
 * それが存在する場合のみ明示的に指定する。通常の開発環境・CIでは
 * `npx playwright install` 済みの標準ブラウザをそのまま使う。
 */
const SANDBOX_CHROMIUM_PATH = "/opt/pw-browsers/chromium";
const chromiumExecutablePath =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ??
  (existsSync(SANDBOX_CHROMIUM_PATH) ? SANDBOX_CHROMIUM_PATH : undefined);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: chromiumExecutablePath ? { executablePath: chromiumExecutablePath } : {},
      },
    },
  ],
});
