import { useState } from "react";
import buttonStyles from "../../shared/ui/Button.module.css";
import { useTheme } from "../../shared/hooks/useTheme";
import { clearAllData } from "../../shared/lib/db";
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

  async function handleReset() {
    const confirmed = window.confirm(
      "学習履歴・進捗・設定をすべて初期化します。この操作は取り消せません。よろしいですか？",
    );
    if (!confirmed) return;
    await clearAllData();
    setResetDone(true);
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

      <p>
        データのエクスポート・インポートはフェーズ2で対応予定です。現時点の学習履歴はブラウザのIndexedDB内にのみ保存されています。
      </p>
    </div>
  );
}
