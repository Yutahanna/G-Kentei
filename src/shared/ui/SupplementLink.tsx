import { Link } from "react-router-dom";
import { findSupplementEntry, supplementEntryPath } from "../lib/supplement-loader";

/**
 * 補遺を出典とする問題（用語確認・計算問題）の「教材参照」に、補遺の該当項目へのリンクを添える。
 * 補遺が出典でない問題、またはアプリにまだ取り込んでいない補遺が出典の問題では何も表示しない。
 */
export default function SupplementLink({
  question,
}: {
  question: { sourceFile: string; sourceHeading: string };
}) {
  const entry = findSupplementEntry(question.sourceFile, question.sourceHeading);
  if (!entry) return null;
  return (
    <>
      {" "}
      <Link to={supplementEntryPath(entry)}>補遺の該当用語を見る</Link>
    </>
  );
}
