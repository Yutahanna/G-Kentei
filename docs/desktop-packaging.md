# Windows デスクトップアプリ化（社内限定配布・非公開）

作成日: 2026-08-02

## 目的・配布方針

本アプリは一般公開しない。利用者は依頼者本人、または限定された社内利用者のみ。
利用者PCにはNode.jsやGitHub Desktopのインストールを求めず、ダブルクリックで起動できる
配布形式（インストーラー／ポータブル実行形式）を提供する。自動更新・外部サーバー接続・
外部公開は前提としない。

## Electron と Tauri の比較・選定

| 観点 | Electron | Tauri | 判定 |
| --- | --- | --- | --- |
| 保守性 | Chromium・Node.jsランタイム全体を同梱・自前管理する必要があり、セキュリティ更新の追随義務が生じる。依存パッケージも大きい。 | OS標準のWebView（Windowsでは WebView2 = Edgeの実行エンジン）を利用するため、ブラウザエンジン自体の保守はOS/Edgeの自動更新に委ねられる。Tauri側で保守するのはRust製の薄いシェルのみ。 | Tauriが優位 |
| 配布の簡便性（生成物サイズ） | Chromium+Node同梱のため生成物は通常100MB超。 | 本アプリでは NSISインストーラー約4.7MB、ポータブルexe約19MB。社内配布（メール添付・共有ドライブ）に適する。 | Tauriが優位 |
| 既存Vite/PWA資産の再利用 | どちらも`dist/`をそのまま埋め込み配信でき、差はない。 | 同左。 | 差なし |
| ビルド環境（本セッション＝Linuxサンドボックス） | LinuxからWindows向けにビルドするには基本的にWineが必要（本環境には未導入・追加検証コストが高い）。 | `mingw-w64`（Windows向けRustターゲット）と`nsis`（`makensis`はLinux移植版が存在）の組み合わせでビルド可能なことを確認済み。 | Tauriが優位 |
| オフライン動作・IndexedDB永続化 | ChromiumのIndexedDB実装をそのまま利用できる。 | WebView2（Chromiumベース）のIndexedDB実装をそのまま利用できる。既存の`src/shared/lib/db.ts`は変更不要。 | 差なし |

以上より、保守性・配布の簡便性のいずれの観点でも **Tauri（v2）** を採用した。

## 実装内容

- 既存の React/Vite/PWA アプリ（`src/`, `vite.config.ts`）は一切変更していない。Web版・PWA版の挙動は従来通り。
- `src-tauri/` にTauri v2のRustシェルを追加（`npx tauri init --ci`で非対話生成し、以後手動調整）。
  - `frontendDist`: `../dist`（既存の`npm run build`成果物をそのまま埋め込み配信）
  - `beforeBuildCommand`: `npm run build`
  - ウィンドウ初期サイズ 1200x800、最小 800x600、タイトル「G検定 学習ドリル」
  - `identifier`: `com.gkentei.drill`、`productName`: `GKenteiDrill`
  - `bundle.targets`: `["nsis"]`（Windows以外のバンドル形式は生成しない）
  - `capabilities/default.json`は初期生成のまま（`core:default`のみ）。フロントエンドはTauri独自APIを一切呼び出しておらず、`@tauri-apps/api`も未使用のため導入していない（不要な依存を増やさない方針）。
  - 自動更新プラグイン（`tauri-plugin-updater`等）は導入していない（初期版では不要という要件に合わせ、意図的に未実装）。
  - アイコンは`public/icon-512.png`から`tauri icon`コマンドで`icon.ico`等を自動生成（Windows向けの`32x32.png`/`128x128.png`/`128x128@2x.png`/`icon.ico`のみ残し、iOS/Android/Appx用の生成物は削除）。
- `package.json`に`desktop:build`（`npm run build && tauri build --target x86_64-pc-windows-gnu`）を追加。
- `eslint.config.js`・`.prettierignore`に`src-tauri`を追加（RustプロジェクトはJS用Lint/Formatの対象外とし、ビルド生成物`src-tauri/target/`がLint対象に混入して壊れる問題を回避）。`src-tauri/target/`はTauri init時点で`src-tauri/.gitignore`により既にGit管理対象外。

## データ永続化・オフライン動作の設計上の根拠

- 学習履歴・SRS状態・模擬試験履歴・ブックマークは、既存実装通りブラウザ標準のIndexedDB（`idb`パッケージ経由、DB名`g-kentei-db`）にのみ保存される。TauriのWindows版はWebView2（Chromiumベース）でレンダリングされ、IndexedDBはWeb標準APIとしてTauri側の許可設定を必要とせず動作する。データの保存場所はWindows上のWebView2ユーザーデータフォルダ（アプリごとに分離、`%LOCALAPPDATA%`配下）であり、外部サーバーへの送信は一切発生しない。
- 全10章・250問の教材・問題データは、既存のVite/PWA版と同じくビルド時にJSへ静的バンドルされる（実行時フェッチなし）ため、`dist/`をそのまま埋め込むTauri版でも追加の同梱作業なしに全問収録される。
- オフライン動作: Tauri版はWeb版のようなService Worker経由のキャッシュ機構を使わず、`dist/`の全ファイルをアプリ内リソースとして直接同梱・ローカル配信するため、原理的に常時オフラインで動作する（インターネット接続は一切前提としない）。

## ビルド・検証結果（本セッション＝Linuxサンドボックス上でのクロスビルド）

- ビルド前提ゲート: `npm run ci`（lint/format:check/typecheck/test/validate:questions/build）、`npm run test:e2e`（Playwright 15件）をいずれも実行し、全件成功したことを確認済み（`src-tauri`追加後に再実行し、既存Web版の挙動・品質ゲートに影響がないことも確認済み）。
- クロスコンパイル環境: `rustup target add x86_64-pc-windows-gnu` に加え、`apt-get install mingw-w64 nsis` でWindows向けリンカとNSISインストーラー生成コマンド（`makensis`）を導入。
- `npx tauri build --target x86_64-pc-windows-gnu` を実行し、以下2種類のWindows向け成果物を生成した。
  - インストーラー形式（NSIS）: `GKenteiDrill_0.1.0_x64-setup.exe`（約4.7MB）
  - ポータブル実行形式: `gkentei-drill.exe`（約19MB、単体で起動可能）
- 両ファイルとも`file`コマンドで`PE32(+) executable ... for MS Windows`であることを確認済み。
- **本セッションはWindows実機を持たないLinuxサンドボックスであるため、生成したexe/インストーラーを実際にWindows上で起動しての動作確認（初回起動、IndexedDB書き込み、オフライン動作、エクスポート/インポート等）は実施できていない。** Web版で確認済みの機能がTauriのWebView2（Chromiumベース、Web標準準拠）上でも動作する設計上の根拠は上記の通りだが、実機での最終確認は利用者側で一度行うことを推奨する。

## 既知の制約・注意事項

1. **未署名アプリである**: コード署名証明書を適用していないため、初回起動時にWindows SmartScreenが「発行元不明のアプリ」として警告を表示する場合がある。社内限定配布のため、「詳細情報」→「実行」で起動可能（後述の起動手順に記載）。
2. **WebView2ランタイムが必要**: Windows 10（2004以降）およびWindows 11には標準で同梱されているため、通常は追加インストール不要。非常に古いWindows 10（2004より前）等でWebView2が存在しない場合のみ、初回起動時にMicrosoftの案内に従ったランタイム導入が必要になる可能性がある（今回はオフライン同梱型のWebView2ランタイムは含めていない。理由: 社内利用PCは最新Windowsである前提が妥当なため、約180MBの同梱によるファイル肥大化を避けた）。
3. **クロスコンパイルは実験的機能**: Tauri公式ドキュメント上、Linux→Windowsのクロスビルドは「experimental」と明記されている。今回はビルド成功・PE形式検証まで確認したが、Windows実機ビルド（またはGitHub ActionsのWindowsランナー）でのビルドの方がより保証された経路である。将来的に本格運用する場合は、Windows環境でのビルドへの切り替えを推奨する。
4. **自動更新は未実装**（要件通り）。バージョンアップ時は本ドキュメントの手順で再ビルドし、インストーラー／ポータブルexeを配布し直す。

## エンドユーザー向け起動手順

### インストーラー版（`GKenteiDrill_0.1.0_x64-setup.exe`）

1. 配布された`GKenteiDrill_0.1.0_x64-setup.exe`をダブルクリックする。
2. 「WindowsによってPCが保護されました」という警告が出た場合は、「詳細情報」をクリックし、「実行」を選択する（未署名アプリのため表示される。社内配布物であることを確認の上で実行する）。
3. インストーラーの案内に従って進める（現在のユーザーのみにインストールされ、管理者権限は不要）。
4. インストール完了後、スタートメニューまたはデスクトップの「GKenteiDrill」から起動する。

### ポータブル版（`gkentei-drill.exe`）

1. 配布された`gkentei-drill.exe`を任意のフォルダに置く。
2. ダブルクリックで起動する（インストール不要）。SmartScreen警告が出た場合の対処は上記と同じ。
3. 学習データは初回起動時にWindows側のアプリ専用領域へ保存されるため、このexeファイル自体を別PCへコピーしても学習データは引き継がれない（データはPCごとに保存される仕様。データの引き継ぎは既存のWeb版と同じ「設定」画面のエクスポート／インポート機能を使用する）。

## 生成物の保存場所

本セッション（クラウド上の一時実行環境）内のビルド成果物は以下に生成されている。

```
src-tauri/target/x86_64-pc-windows-gnu/release/bundle/nsis/GKenteiDrill_0.1.0_x64-setup.exe
src-tauri/target/x86_64-pc-windows-gnu/release/gkentei-drill.exe
```

この`target/`ディレクトリはビルド生成物のためGit管理対象外（`.gitignore`）である。セッション終了後も
成果物を保持するには、チャット経由で送付されたファイルを保存するか、`npm run desktop:build`を
（Rust + mingw-w64 + nsisが導入された環境で）再実行して再生成する。
