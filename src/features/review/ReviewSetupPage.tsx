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

const EMPTY_BUCKETS: ReviewBuckets = {
  mockReview: [],
  dueForReview: [],
  wrongAnswer: [],
  bookmarked: [],
};

const BATCH_SIZES = [20, 30] as const;

const SECONDARY_BUCKET_DEFS: {
  type: ReviewSessionType;
  key: keyof ReviewBuckets;
  title: string;
  description: string;
}[] = [
  {
    type: "wrong_answer",
    key: "wrongAnswer",
    title: "直近の回答が誤答の問題",
    description: "ドリル・復習・模試を問わず、直近の回答が不正解だった問題です。",
  },
  {
    type: "due_for_review",
    key: "dueForReview",
    title: "SRSで復習が必要な問題",
    description: "間隔反復のスケジュールに基づき、そろそろ復習すべき問題です。",
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
  const [batchSize, setBatchSize] = useState<number>(BATCH_SIZES[0]);
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
      mockReview: buckets.mockReview.filter(filterFn),
      dueForReview: buckets.dueForReview.filter(filterFn),
      wrongAnswer: buckets.wrongAnswer.filter(filterFn),
      bookmarked: buckets.bookmarked.filter(filterFn),
    };
  }, [buckets, chapterFilter]);

  function handleStart(type: ReviewSessionType, ids: string[], limit?: number) {
    startSession(type, shuffle(ids).slice(0, limit));
    void navigate("/review/play");
  }

  const mockReviewIds = filteredBuckets.mockReview;

  return (
    <div>
      <h1>復習</h1>
      <p>
        模擬試験で誤答・未回答だった問題と、ブックマークした問題から、20問・30問ずつ復習します。模試の誤答は、その後2回続けて正解すると対象から外れます。ブックマークは外すまで残ります。
      </p>

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

      <Card>
        <div className={styles.cardTitle}>模試の誤答・ブックマーク</div>
        <div className={styles.count}>{isLoading ? "…" : `${mockReviewIds.length}問`}</div>
        <div className={styles.batchRow} role="radiogroup" aria-label="1回の出題数">
          {BATCH_SIZES.map((size) => (
            <label key={size}>
              <input
                type="radio"
                name="batch-size"
                checked={batchSize === size}
                onChange={() => setBatchSize(size)}
              />
              {size}問
            </label>
          ))}
        </div>
        <button
          type="button"
          className={buttonStyles.button}
          disabled={isLoading || mockReviewIds.length === 0}
          onClick={() => handleStart("mock_review", mockReviewIds, batchSize)}
        >
          {Math.min(batchSize, mockReviewIds.length)}問で復習を始める
        </button>
      </Card>

      <h2 className={styles.secondaryHeading}>その他の復習</h2>
      <div className={styles.grid}>
        {SECONDARY_BUCKET_DEFS.map((def) => {
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
                onClick={() => handleStart(def.type, ids, batchSize)}
              >
                {Math.min(batchSize, ids.length)}問で始める
              </button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
