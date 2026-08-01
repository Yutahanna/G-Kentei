import { NavLink, Outlet } from "react-router-dom";
import styles from "./Layout.module.css";
import { useTheme } from "../shared/hooks/useTheme";

const NAV_ITEMS = [
  { to: "/", label: "ホーム", end: true },
  { to: "/materials", label: "教材" },
  { to: "/drill", label: "ドリル" },
  { to: "/settings", label: "設定" },
];

export default function Layout() {
  useTheme();

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
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
