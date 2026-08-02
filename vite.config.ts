import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
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
        // アプリシェル（HTML/JS/CSS/アイコン）の事前キャッシュのみでオフライン動作する。
        globPatterns: ["**/*.{js,css,html,png,svg}"],
        navigateFallback: "index.html",
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
