import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../shared/ui/Card";
import buttonStyles from "../../shared/ui/Button.module.css";
import { getManifest } from "../../shared/lib/content-loader";
import { getQuestionById } from "../../shared/lib/question-loader";
import { getReviewBuckets, type ReviewBuckets } from "../../shared/lib/review";
import {
  useReviewSessionStore,
  type ReviewSessionType,
} from "../../shared/store/reviewSessionStore";
import styles from "./ReviewSetupPage.module.css";

const EMPTY_BUCKETS: ReviewBuckets = { dueForReview: [], wrongAnswer: [], bookmarked: [] };

const BUCKET_DEFS: {
  type: ReviewSessionType;
  key: keyof ReviewBuckets;
  title: string;
  description: string;
}[] = [
  {
    type: "due_for_review",
    key: "dueForReview",
    title: "SRSで復習が必要な問題",
    description: "間隔反復のスケジュールに基づき、そろそろ復習すべき問題です。",
  },
  {
    type: "wrong_answer",
    key: "wrongAnswer",
    title: "誤答のみ復習",
    description: "直近の回答が不正解だった問題だけを集めて復習します。",
  },
  {
    type: "bookmarked",
    key: "bookmarked",
    title: "ブックマークした問題",
    description: "ドリル中にブックマークした問題を復習します。",
  },
];

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export default function ReviewSetupPage() {
  const navigate = useNavigate();
  const manifest = getManifest();
  const [buckets, setBuckets] = useState<ReviewBuckets>(EMPTY_BUCKETS);
  const [isLoading, setIsLoading] = useState(true);
  const [chapterFilter, setChapterFilter] = useState("");
  const startSession = useReviewSessionStore((s) => s.startSession);

  useEffect(() => {
    let cancelled = false;
    void getReviewBuckets().then((b) => {
      if (!cancelled) {
        setBuckets(b);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredBuckets = useMemo(() => {
    if (!chapterFilter) return buckets;
    const filterFn = (id: string) => getQuestionById(id)?.chapterId === chapterFilter;
    return {
      dueForReview: buckets.dueForReview.filter(filterFn),
      wrongAnswer: buckets.wrongAnswer.filter(filterFn),
      bookmarked: buckets.bookmarked.filter(filterFn),
    };
  }, [buckets, chapterFilter]);

  function handleStart(type: ReviewSessionType, ids: string[]) {
    startSession(type, shuffle(ids));
    void navigate("/review/play");
  }

  return (
    <div>
      <h1>復習</h1>
      <p>SRSの復習予定、誤答のみ、ブックマークの3種類から選んで復習できます。</p>

      <div className={styles.filter}>
        <label htmlFor="review-chapter-filter">章で絞り込み</label>
        <select
          id="review-chapter-filter"
          value={chapterFilter}
          onChange={(e) => setChapterFilter(e.target.value)}
        >
          <option value="">すべての章</option>
          {manifest.chapters.map((c) => (
            <option key={c.chapterId} value={c.chapterId}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.grid}>
        {BUCKET_DEFS.map((def) => {
          const ids = filteredBuckets[def.key];
          return (
            <Card key={def.type}>
              <div className={styles.cardTitle}>{def.title}</div>
              <p className={styles.cardDescription}>{def.description}</p>
              <div className={styles.count}>{isLoading ? "…" : `${ids.length}問`}</div>
              <button
                type="button"
                className={buttonStyles.button}
                disabled={isLoading || ids.length === 0}
                onClick={() => handleStart(def.type, ids)}
              >
                この復習を始める
              </button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
