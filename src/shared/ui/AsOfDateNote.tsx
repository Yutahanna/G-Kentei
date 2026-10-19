import styles from "./AsOfDateNote.module.css";

/**
 * 法律・制度・ガイドラインなど時点で変わりうる内容の問題に、教材の確認基準日を添える。
 * 問題データのasOfDate(YYYY-MM-DD)が無い問題では何も表示しない。
 */
export default function AsOfDateNote({ asOfDate }: { asOfDate: string | undefined }) {
  if (!asOfDate) return null;
  const [year, month, day] = asOfDate.split("-").map(Number);
  return (
    <p className={styles.note}>
      教材の確認基準日：{year}年{month}月{day}
      日。法律・制度・ガイドラインは、その後改正・更新されている場合があります。
    </p>
  );
}
