# 依存関係リスク記録：react-router advisory（GHSA-qwww-vcr4-c8h2）

作成日: 2026-08-02
状態: 既知リスクとして記録。公開のブロッカーとはしない。次回確認タイミング: 下記参照。

## advisoryの内容

- **対象パッケージ**: `react-router`（本アプリは `react-router-dom@7.18.2` を直接の依存として
  使用しており、`react-router-dom` が内部で `react-router@7.18.2` に依存している）。
- **対象バージョン範囲**: `react-router` 7.12.0 以上 8.3.0 未満（`npm audit` 上は
  `react-router-dom` は `>=7.12.0-pre.0` として表示される）。
- **深刻度**: High（CVSS個別スコアは advisory 上未設定、CWE-352 クロスサイトリクエストフォージェリ）。
- **タイトル**: "React Router: RSC Mode CSRF Bypass Allows Action Execution Before 400 Response"
- **対象機能**: React Router の **RSC（React Server Components）モード**において、
  `action` 関数がCSRF保護（Originチェックによる400応答）を経由する前に実行されてしまう
  不具合。RSCモード特有の実行経路（サーバーアクションのルーティング処理）に限定された脆弱性であり、
  参考: https://github.com/advisories/GHSA-qwww-vcr4-c8h2

## 本アプリへの適用可否

本アプリは、`react-router-dom` の **`<BrowserRouter>` を用いた通常のクライアントサイドSPA構成**
（`src/main.tsx` 参照）であり、以下のいずれも使用していない。

- React Server Components（RSC）
- `react-router` のフレームワークモード／サーバーアクション（`action`関数によるサーバー側処理）
- Node.jsサーバーを介したSSR/SSRストリーミング

advisoryが対象とする脆弱性は、これらRSCモード・サーバーアクション実行経路が有効な場合にのみ
成立するため、本アプリの実行モデル（IndexedDBのみを使ったクライアントサイド完結型アプリ、
サーバー側の`action`実行やCSRF保護対象となるオリジン間リクエストが存在しない）には該当しない。

## 修正版の有無（2026-08-02時点）

- 本アプリが直接依存する `react-router-dom` の最新公開バージョンは `7.18.2` であり、これは
  引き続き脆弱なバージョン範囲内の `react-router@7.18.2` に依存している。
- 修正済みの `react-router@8.3.0` は公開されているが、`react-router-dom` 側はまだ
  `react-router@8.x` に対応したバージョンを公開していない（`react-router-dom`の8系は
  2026-08-02時点で存在しない）。
- `npm audit fix` / `npm audit fix --force` のいずれも、本アプリの依存構成
  （`react-router-dom`経由）に対して有効な修正を適用できないことを確認済み
  （`npm audit fix --dry-run` 実行後も同一の脆弱性が報告される）。

## 公開を妨げる実質的リスクではないと判断した理由

1. 脆弱性はRSCモード・サーバーアクション実行経路に限定されており、本アプリはそのいずれも
   使用しない静的ホスティング前提のクライアントサイドSPAである。
2. 本アプリにサーバー側のアクション処理・オリジン間リクエストを受け付けるエンドポイントは
   存在しない（データはすべてブラウザのIndexedDBに閉じている）。
3. 現時点で `react-router-dom` 側に適用可能な修正版が存在しないため、たとえこのリスクを
   重大と判断した場合でも、依存関係の更新によって直ちに解消する手段がない。

以上より、この既知の advisory を理由に本リリースを停止する必要はないと判断する。

## 再確認のタイミング

- `react-router-dom` が `react-router@8.3.0`以降に対応したバージョンを公開した時点で、
  `npm outdated react-router-dom` および `npm audit` を再実行し、アップグレードを検討する。
- 本アプリがRSCモード・サーバーアクション・SSRを新たに採用する設計変更を行う場合は、
  その前に必ずこのadvisoryの状況を再確認する。
