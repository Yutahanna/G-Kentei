import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div>
      <h1>ページが見つかりません</h1>
      <p>
        <Link to="/">ホームに戻る</Link>
      </p>
    </div>
  );
}
