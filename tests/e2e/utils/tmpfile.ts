import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const TMP_DIR = join(process.cwd(), "test-results", ".e2e-tmp");

/**
 * page.setInputFiles() に渡すファイルをASCII安全なパスへ書き出す。
 * testInfo.outputPath() はテストタイトル（日本語を含む）をディレクトリ名に
 * 使うため、そのパスをファイルアップロードに使うと、この環境では
 * setInputFilesが該当ファイルを読み込めず、無言で失敗することが判明した。
 * ASCIIのみのファイル名を使うことで確実に動作させる。
 */
export function writeTempUploadFile(name: string, content: unknown): string {
  mkdirSync(TMP_DIR, { recursive: true });
  const path = join(TMP_DIR, name);
  writeFileSync(path, JSON.stringify(content));
  return path;
}
