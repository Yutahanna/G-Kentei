import { useEffect, useState } from "react";
import { checkForUpdate, type UpdateStatus } from "../lib/updateCheck";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** 起動時・画面復帰時・1時間ごとに最新版の有無を確認する（本番ビルドのみ）。 */
export function useUpdateStatus(): UpdateStatus {
  const [status, setStatus] = useState<UpdateStatus>("unknown");

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const run = () => void checkForUpdate().then(setStatus);
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    run();
    const timer = setInterval(run, CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return status;
}
