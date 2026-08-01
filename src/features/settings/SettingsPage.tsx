import { useRef, useState } from "react";
import buttonStyles from "../../shared/ui/Button.module.css";
import { useTheme } from "../../shared/hooks/useTheme";
import { clearAllData, exportAllData, importAllData } from "../../shared/lib/db";
import { exportedDataSchema } from "../../schemas/progress.schema";
import type { ThemeSetting } from "../../entities/progress";
import styles from "./SettingsPage.module.css";

const THEME_OPTIONS: { value: ThemeSetting; label: string }[] = [
  { value: "light", label: "ライトモード" },
  { value: "dark", label: "ダークモード" },
  { value: "system", label: "端末の設定に合わせる" },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [resetDone, setResetDone] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleReset() {
    const confirmed = window.confirm(
      "学習履歴・進捗・設定をすべて初期化します。この操作は取り消せません。よろしいですか？",
    );
    if (!confirmed) return;
    await clearAllData();
    setResetDone(true);
  }

  async function handleExport() {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `g-kentei-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImportMessage(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setImportMessage({ type: "error", text: "ファイルの読み込みに失敗しました。JSON形式のバックアップファイルを選択してください。" });
      return;
    }

    const result = exportedDataSchema.safeParse(parsed);
    if (!result.success) {
      setImportMessage({ type: "error", text: "ファイルの内容がバックアップデータの形式と一致しません。" });
      return;
    }

    const confirmed = window.confirm(
      "現在の学習履歴・進捗・設定をすべて、このファイルの内容で置き換えます。この操作は取り消せません。よろしいですか？",
    );
    if (!confirmed) return;

    await importAllData(result.data);
    setImportMessage({ type: "success", text: "インポートしました。ページを再読み込みしてください。" });
  }

  return (
    <div>
      <h1>設定</h1>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>表示テーマ</legend>
        {THEME_OPTIONS.map((opt) => (
          <div key={opt.value} className={styles.radioRow}>
            <input
              type="radio"
              id={`theme-${opt.value}`}
              name="theme"
              checked={theme === opt.value}
              onChange={() => void setTheme(opt.value)}
            />
            <label htmlFor={`theme-${opt.value}`}>{opt.label}</label>
          </div>
        ))}
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>データのエクスポート・インポート</legend>
        <p>
          学習履歴・進捗・設定をJSONファイルとして書き出し、別の端末やブラウザに復元できます。
          データはブラウザのIndexedDB内にのみ保存されているため、機種変更やブラウザデータ削除の前にエクスポートしておくことをお勧めします。
        </p>
        <div className={styles.buttonRow}>
          <button type="button" className={buttonStyles.button} onClick={() => void handleExport()}>
            データをエクスポートする
          </button>
          <button
            type="button"
            className={`${buttonStyles.button} ${buttonStyles.secondary}`}
            onClick={() => fileInputRef.current?.click()}
          >
            データをインポートする
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className={styles.hiddenFileInput}
            onChange={(e) => void handleImportFileChange(e)}
          />
        </div>
        {importMessage && (
          <p role="status" className={importMessage.type === "error" ? styles.errorText : undefined}>
            {importMessage.text}
          </p>
        )}
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>データの初期化</legend>
        <p>学習履歴・問題の回答結果・復習状態・設定をすべて削除し、初期状態に戻します。</p>
        <button
          type="button"
          className={`${buttonStyles.button} ${styles.dangerButton}`}
          onClick={() => void handleReset()}
        >
          データを初期化する
        </button>
        {resetDone && <p role="status">初期化しました。ページを再読み込みしてください。</p>}
      </fieldset>
    </div>
  );
}
