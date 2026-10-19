/**
 * ビルド情報（vite.config.tsでビルド時に埋め込む）と、配信URLの判定。
 *
 * Cloudflare Pagesはデプロイごとに `<8桁の16進数>.<プロジェクト>.pages.dev` という
 * そのデプロイ時点に固定されたURLを発行する。このURLをブックマーク・ホーム画面追加すると、
 * 以後のデプロイが反映されず古い教材・設問のまま使い続けることになるため、検知して案内する。
 */
export const BUILD_SHA: string = import.meta.env.VITE_BUILD_SHA ?? "";
export const BUILD_TIME: string = import.meta.env.VITE_BUILD_TIME ?? "";

const PINNED_DEPLOYMENT_HOST = /^[0-9a-f]{8}\.([a-z0-9-]+\.pages\.dev)$/i;

/** 固定デプロイURLなら、対応する本番（最新版）のホスト名を返す。それ以外はnull。 */
export function getProductionHostForPinnedDeployment(host: string): string | null {
  const match = PINNED_DEPLOYMENT_HOST.exec(host);
  return match ? match[1]! : null;
}

/** ビルド日時を日本時間の「YYYY/MM/DD HH:mm」で表示する。不正値・未設定は「不明」。 */
export function formatBuildTime(iso: string): string {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return "不明";
  return date.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
