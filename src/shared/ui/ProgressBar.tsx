import styles from "./ProgressBar.module.css";

interface ProgressBarProps {
  ratio: number; // 0-1
  label: string;
}

export default function ProgressBar({ ratio, label }: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, ratio));
  return (
    <div
      className={styles.track}
      role="progressbar"
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={styles.fill} style={{ width: `${clamped * 100}%` }} />
    </div>
  );
}
