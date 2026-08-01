import { create } from "zustand";
import { getUserSettings, saveUserSettings } from "../lib/db";
import type { ThemeSetting, UserSettings } from "../../entities/progress";
import { DEFAULT_USER_SETTINGS } from "../../entities/progress";

/**
 * テーマ設定のメモリ上キャッシュ。永続化はIndexedDB（userSettingsストア）が担い、
 * このストアはUIに配るための即時参照用の値を保持する。
 */

interface ThemeState {
  theme: ThemeSetting;
  isLoaded: boolean;
  loadFromDb: () => Promise<void>;
  setTheme: (theme: ThemeSetting) => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: DEFAULT_USER_SETTINGS.theme,
  isLoaded: false,
  loadFromDb: async () => {
    const settings = await getUserSettings();
    set({ theme: settings.theme, isLoaded: true });
  },
  setTheme: async (theme) => {
    set({ theme });
    const current = await getUserSettings();
    const next: UserSettings = { ...current, theme };
    await saveUserSettings(next);
  },
}));

export function resolveEffectiveTheme(theme: ThemeSetting): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}
