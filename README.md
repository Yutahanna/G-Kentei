# G検定 学習アプリ用リポジトリ

G検定の正式版学習テキストを基に、章別学習、確認問題、模擬試験、復習機能を持つ学習アプリを開発するためのリポジトリです。

## 教材

- `materials/chapters/`: Claude Codeが優先して読む章別Markdown
- `materials/G検定_学習テキスト_Rev0.md`: 全文をまとめたMarkdown
- `materials/INDEX.md`: 章別ファイルの一覧と読み込み順

## 開発時の原則

1. 教材本文を正規の情報源として扱う。
2. 教材にない知識を問題や解説へ追加する場合は、教材由来と区別する。
3. 問題データ、進捗データ、アプリコードは教材ファイルと分離する。
4. 教材本文を直接書き換えず、修正提案は別ファイルに記録する。

## ディレクトリ構成

```text
materials/       教材Markdown（正本）
content/         materialsから生成する構造化JSON（自動生成物、直接編集禁止）
questions/       問題データ（レビュー対象）
scripts/         変換・検証スクリプト
src/             アプリ本体
public/          静的ファイル
tests/           単体テスト
docs/            設計資料・レビュー資料
```

詳細な設計方針は [`docs/phase0-design.md`](docs/phase0-design.md) を参照してください。

## セットアップ

```bash
npm install
```

## 起動方法（開発サーバー）

```bash
npm run dev
```

表示されるURL（既定では http://localhost:5173 ）をブラウザで開いてください。ホーム画面から教材閲覧・章別ドリル・設定にアクセスできます。フェーズ1時点では第1章のみ利用できます。

学習履歴・問題の回答結果・復習状態はブラウザのIndexedDBに保存されます。設定画面から初期化できます。

## 本番ビルド・プレビュー

```bash
npm run build      # dist/ に本番ビルドを出力
npm run preview    # ビルド結果をローカルで確認
```

## テスト方法

```bash
npm run test        # Vitestによる単体テストを1回実行
npm run test:watch  # ウォッチモードで実行
```

対象: `tests/unit/` 配下（SRSロジック、採点ロジック、教材ビルドパイプラインのパーサー、問題データ読み込み）。

## 教材・問題データの検証方法

```bash
npm run build:content        # materials/chapters/*.md → content/*.json への変換（既定は第1章のみ）
npm run build:content -- 03  # 章番号を指定して変換する場合

npm run validate:questions   # questions/ 配下の問題データを検証し、docs/content-mapping.md を生成

npm run review -- ch01       # 指定した章の問題データのレビュー用一覧 docs/{chapterId}-question-review.md を生成（全問詳細表示）
npm run review:ch01          # ↑ ch01専用のショートカット
npm run review -- ch03 --focused  # 重点レビュー対象（代表サンプル＋警告あり問題＋章横断タグ問題）のみ詳細表示、他は簡易表示（第3章以降で使用）

npm run compare:materials    # materials/chapters/*.md と全文版materials/G検定_学習テキスト_Rev0.md の突き合わせ
```

## コード品質チェック

```bash
npm run lint          # ESLint
npm run format        # Prettierで整形
npm run format:check  # Prettierの整形チェックのみ（CI用）
npm run typecheck     # tsc -b --noEmit
```

すべてまとめて実行する場合:

```bash
npm run ci   # lint → typecheck → test → validate:questions → build
```

GitHub Actions（`.github/workflows/ci.yml`）でも同じ内容をpush・PRごとに自動実行します。

## 開発時の原則

1. 教材本文を正規の情報源として扱う。
2. 教材にない知識を問題や解説へ追加する場合は、教材由来と区別する。
3. 問題データ、進捗データ、アプリコードは教材ファイルと分離する。
4. 教材本文を直接書き換えず、修正提案は別ファイルに記録する。
5. `content/` 配下の生成JSONは自動生成物であり、直接編集しない（`materials/` またはビルドスクリプトを修正する）。
