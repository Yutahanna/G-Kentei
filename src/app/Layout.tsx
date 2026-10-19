import { NavLink, Outlet } from "react-router-dom";
import styles from "./Layout.module.css";
import { useTheme } from "../shared/hooks/useTheme";
import { getProductionHostForPinnedDeployment } from "../shared/lib/buildInfo";

const NAV_ITEMS = [
  { to: "/", label: "ホーム", end: true },
  { to: "/materials", label: "教材" },
  { to: "/drill", label: "ドリル" },
  { to: "/review", label: "復習" },
  { to: "/exam", label: "模擬試験" },
  { to: "/settings", label: "設定" },
];

export default function Layout() {
  useTheme();
  const productionHost = getProductionHostForPinnedDeployment(window.location.host);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <NavLink to="/" className={styles.brand}>
            G検定 学習ドリル
          </NavLink>
          <nav className={styles.nav} aria-label="グローバルナビゲーション">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      {productionHost && (
        <div role="alert" className={styles.pinnedBanner}>
          このURLは過去のある時点に固定された版のため、教材・問題の修正が反映されません。最新版は{" "}
          <a href={`https://${productionHost}/`}>https://{productionHost}/</a>{" "}
          を開き、ブックマーク・ホーム画面のアプリも登録し直してください（学習履歴はURLごとに別保存のため、設定画面のエクスポート・インポートで移せます）。
        </div>
      )}
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
