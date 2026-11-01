import { createJSONStorage } from "zustand/middleware";

/**
 * 実行中のドリル・復習・模擬試験の状態をタブ単位で保存する保存先。
 * 新しい版の適用やモバイルブラウザによるタブの破棄でページが読み込み直されても、
 * 解いている途中から再開できるようにする（タブを閉じれば消えてよいのでsessionStorage）。
 * 回答結果そのものはこれとは別にIndexedDBへ1問ごとに保存している。
 * sessionStorageが使えない環境（プライベートモードの一部など）では永続化せずに動作する。
 */
export const sessionStateStorage = createJSONStorage(() => sessionStorage);

/**
 * 保存形式の版。2: 回答を選択肢の配列（selected）で持つ形式（すべて選ぶ問題に対応、2026-11-01）。
 * 1（版指定なし）の保存内容は、selectedIndexを1要素の配列に変換して引き継ぐ。
 */
export const SESSION_STATE_VERSION = 2;

type LegacyRecord = { selectedIndex?: number | null; selected?: number[] };

function toSelected(record: LegacyRecord): number[] {
  if (Array.isArray(record.selected)) return record.selected;
  return typeof record.selectedIndex === "number" && record.selectedIndex >= 0
    ? [record.selectedIndex]
    : [];
}

function migrateRecord<T extends LegacyRecord>(
  record: T,
): Omit<T, "selectedIndex"> & {
  selected: number[];
} {
  const rest: Partial<T> = { ...record };
  delete rest.selectedIndex;
  return { ...(rest as Omit<T, "selectedIndex">), selected: toSelected(record) };
}

/** ドリル・復習の途中状態（answers配列とlastFeedback）を現在の形式に変換する。 */
export function migrateAnswerListState(persisted: unknown): unknown {
  const state = persisted as { answers?: LegacyRecord[]; lastFeedback?: LegacyRecord | null };
  return {
    ...state,
    answers: (state.answers ?? []).map(migrateRecord),
    lastFeedback: state.lastFeedback ? migrateRecord(state.lastFeedback) : null,
  };
}

/** 模擬試験の途中状態（問題ID→回答）を現在の形式に変換する。 */
export function migrateAnswerMapState(persisted: unknown): unknown {
  const state = persisted as { answers?: Record<string, LegacyRecord> };
  return {
    ...state,
    answers: Object.fromEntries(
      Object.entries(state.answers ?? {}).map(([id, a]) => [id, migrateRecord(a)]),
    ),
  };
}
