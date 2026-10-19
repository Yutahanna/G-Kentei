import { BUILD_SHA } from "./buildInfo";

/**
 * 配信中の最新ビルドと、いま動いているビルドを比べる。
 * - "auth-expired": version.jsonの取得がリダイレクトされた（Cloudflare Accessのログイン期限切れ）
 * - "update-available": 配信中のビルドが新しい
 * - "up-to-date" / "unknown"（オフライン・開発環境など判定できない場合）
 */
export type UpdateStatus = "up-to-date" | "update-available" | "auth-expired" | "unknown";

export function judgeUpdateStatus(
  response: Pick<Response, "type" | "ok" | "status">,
  latestSha: string | undefined,
  currentSha: string,
): UpdateStatus {
  if (response.type === "opaqueredirect" || response.status === 401 || response.status === 403) {
    return "auth-expired";
  }
  if (!response.ok || !latestSha || !currentSha) return "unknown";
  return latestSha === currentSha ? "up-to-date" : "update-available";
}

export async function checkForUpdate(): Promise<UpdateStatus> {
  try {
    const response = await fetch("/version.json", { cache: "no-store", redirect: "manual" });
    let latestSha: string | undefined;
    if (response.ok) {
      const body: unknown = await response.json().catch(() => null);
      if (body && typeof body === "object" && "sha" in body && typeof body.sha === "string") {
        latestSha = body.sha;
      }
    }
    return judgeUpdateStatus(response, latestSha, BUILD_SHA);
  } catch {
    return "unknown";
  }
}
