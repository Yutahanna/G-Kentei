import { registerSW } from "virtual:pwa-register";

/**
 * Service Workerの更新確認間隔。開いたままのPWA/タブでも、この間隔ごとに
 * サーバー側の新しいビルド（教材・設問データの修正を含む）を取得しておく。
 * 取得した新しい版は待機状態のまま置いておき、applyUpdate()を呼んだときに切り替える
 * （ドリルや模試の途中で勝手にページを読み込み直さないため）。
 */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | null = null;

export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  updateServiceWorker = registerSW({
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

/**
 * 新しい版に切り替えてページを読み込み直す。画面上部のお知らせの「再読み込みする」から呼ぶ。
 * 新しいService Workerがまだ取得されていなければ取得を試み、待機中のものがあれば有効化してから
 * 読み込み直す。どちらでもなければ通常の再読み込みをする。
 */
export async function applyUpdate(): Promise<void> {
  const registration =
    "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  if (registration) {
    await registration.update().catch(() => undefined);
    if (registration.waiting && updateServiceWorker) {
      await updateServiceWorker(true);
      return;
    }
  }
  window.location.reload();
}
