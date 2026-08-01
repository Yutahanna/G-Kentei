import { useState } from "react";
import { Link } from "react-router-dom";
import Card from "../../shared/ui/Card";
import { getManifest } from "../../shared/lib/content-loader";
import styles from "./ChapterListPage.module.css";

type SortOrder = "number" | "recommended";

export default function ChapterListPage() {
  const [order, setOrder] = useState<SortOrder>("number");
  const manifest = getManifest();

  const chapters = [...manifest.chapters].sort((a, b) => {
    if (order === "number") {
      return a.chapterId.localeCompare(b.chapterId);
    }
    return a.chapterId.localeCompare(b.chapterId); // フェーズ1は第1章のみのため並び順は同一
  });

  return (
    <div>
      <h1>教材</h1>
      <div className={styles.toggle} role="group" aria-label="章の並び順">
        <button
          type="button"
          className={order === "number" ? styles.toggleButtonActive : styles.toggleButton}
          onClick={() => setOrder("number")}
          aria-pressed={order === "number"}
        >
          章番号順
        </button>
        <button
          type="button"
          className={order === "recommended" ? styles.toggleButtonActive : styles.toggleButton}
          onClick={() => setOrder("recommended")}
          aria-pressed={order === "recommended"}
        >
          推奨学習順
        </button>
      </div>
      <p className={styles.note}>
        フェーズ1では第1章のみ利用できます。全章対応後は、教材の
        <code>materials/03_推奨学習順.md</code>
        に基づく順序にも切り替えられます。
      </p>
      <div className={styles.list}>
        {chapters.map((chapter) => (
          <Card key={chapter.chapterId}>
            <Link to={`/materials/${chapter.chapterId}`} className={styles.chapterLink}>
              {chapter.title}
            </Link>
            <div className={styles.meta}>節数: {chapter.sectionIds.length}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
