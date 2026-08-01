import { useEffect } from "react";
import { useThemeStore, resolveEffectiveTheme } from "../store/themeStore";

/** テーマ設定をIndexedDBから読み込み、documentのdata-theme属性に反映し続けるフック。 */
export function useTheme() {
  const theme = useThemeStore((s) => s.theme);
  const isLoaded = useThemeStore((s) => s.isLoaded);
  const loadFromDb = useThemeStore((s) => s.loadFromDb);
  const setTheme = useThemeStore((s) => s.setTheme);

  useEffect(() => {
    void loadFromDb();
  }, [loadFromDb]);

  useEffect(() => {
    if (!isLoaded) return;
    const apply = () => {
      document.documentElement.dataset.theme = resolveEffectiveTheme(theme);
    };
    apply();

    if (theme === "system") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }
    return undefined;
  }, [theme, isLoaded]);

  return { theme, isLoaded, setTheme };
}
