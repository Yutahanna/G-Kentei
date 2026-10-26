import { createJSONStorage } from "zustand/middleware";

/**
 * 実行中のドリル・復習・模擬試験の状態をタブ単位で保存する保存先。
 * 新しい版の適用やモバイルブラウザによるタブの破棄でページが読み込み直されても、
 * 解いている途中から再開できるようにする（タブを閉じれば消えてよいのでsessionStorage）。
 * 回答結果そのものはこれとは別にIndexedDBへ1問ごとに保存している。
 * sessionStorageが使えない環境（プライベートモードの一部など）では永続化せずに動作する。
 */
export const sessionStateStorage = createJSONStorage(() => sessionStorage);
