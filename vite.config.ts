import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from "path";
import { execSync } from "child_process";

// 設定画面に表示するビルド情報。VITE_接頭辞のprocess.envはimport.meta.envへ自動で公開される。
// CIではGITHUB_SHA、ローカルではgitのHEADを使い、どちらも取れない場合は空文字にする。
function resolveBuildSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
}
process.env.VITE_BUILD_SHA = resolveBuildSha();
process.env.VITE_BUILD_TIME = new Date().toISOString();

// 配信中の最新ビルドをアプリ側から確認するためのversion.json（Service Workerの事前キャッシュ対象外）。
function versionJsonPlugin(): Plugin {
  return {
    name: "emit-version-json",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({
          sha: process.env.VITE_BUILD_SHA,
          builtAt: process.env.VITE_BUILD_TIME,
        }),
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    versionJsonPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      // registerSW()をsrc/main.tsxからvirtual:pwa-register経由で呼ぶことで、
      // vite-plugin-pwaが自動的にinjectRegisterを無効化し(素のnavigator.serviceWorker.register()の
      // 自動注入を止める)、Workbox側のskipWaiting/clientsClaimも引き続き有効になる。
      // injectRegisterをここで明示的にfalseにしないこと
      // （falseはnull/autoと異なり、Workbox側のskipWaiting/clientsClaim自動設定を無効化してしまい、
      // 新しいService Workerが`waiting`のまま有効化されなくなる）。
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        name: "G検定 学習ドリル",
        short_name: "G検定ドリル",
        description: "G検定の正式版学習テキストに準拠した学習・ドリルアプリ",
        lang: "ja",
        start_url: "/",
        display: "standalone",
        background_color: "#f7f7f5",
        theme_color: "#2f5d8a",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // 教材・問題データはビルド時にJSへバンドル済みで実行時フェッチが無いため、
        // JS/CSS/アイコンの事前キャッシュと、下記のHTMLキャッシュでオフライン動作する。
        //
        // HTML（画面遷移）は事前キャッシュせずネットワーク優先にする。Cloudflare Accessの
        // ログイン期限が切れた後もキャッシュのHTMLを返し続けると、ログイン画面が出ないまま
        // sw.jsの更新確認だけがログインページへのリダイレクトで失敗し続け、古い版から
        // 抜け出せなくなるため（2026-10-19、8月末の設問が出題され続けた事象の対策）。
        globPatterns: ["**/*.{js,css,png,svg}"],
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "app-shell",
              networkTimeoutSeconds: 5,
              // SPAのため、どのURLへの遷移も同じindex.htmlとして1件だけキャッシュする。
              plugins: [{ cacheKeyWillBeUsed: () => Promise.resolve("/index.html") }],
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
    },
  },
  build: {
    target: "es2020",
    sourcemap: true,
  },
});
