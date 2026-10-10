import { registerSW } from "virtual:pwa-register";

/**
 * Service Workerの更新確認間隔。開いたままのPWA/タブでも、この間隔ごとに
 * サーバー側の新しいビルド（教材・設問データの修正を含む）を検知できるようにする。
 */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) {
        return;
      }
      setInterval(() => {
        void registration.update();
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });
}
