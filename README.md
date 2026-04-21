# AllManga Inbox

複数の web 漫画サイトを横断収集して、未読スタック中心の private dashboard と metadata-only の public-safe ページを提供する self-hosted アプリです。

現在は Google アカウント allowlist 方式で、少人数の複数ユーザー運用に広げられる土台まで入っています。

## Documentation

- [Free public Pages deployment](docs/free-public-pages.md)
- [GCP deployment](docs/deploy-gcp.md)
- [Cost and public release notes](docs/cost-and-public-release.md)
- [Public release checklist](docs/public-release-checklist.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## 特徴

- Next.js App Router + TypeScript + Tailwind + Prisma + PostgreSQL 構成
- private dashboard と public-safe page を route / API / データ整形で分離
- フォロー作品の未読本編を最上位に出す漫画 inbox
- `today / stack / weekend / archived` の lane 管理
- rule-based semantic classifier
- site adapter 方式
- mobile-first UI と下部タブ
- Docker / docker-compose / seed / tests 付き
- shared data と user state を分離し、Cloud Run + Cloud SQL へ持っていきやすい構成

## 今の全体像

- 共有データ
  - `Site / Work / Release / SyncRun / AppSetting`
  - サイト収集や共有 feed snapshot はここに入ります。
- ユーザーごとの状態
  - `User / UserSetting / UserWorkPref / UserReleaseState`
  - フォロー、既読、表示設定、並び順はユーザー単位です。
- 認証
  - 本番は Google OAuth + allowlist でログインします。
  - cookie には DB-backed session token だけを保存します。
  - パスワードログインは開発・移行用 fallback として残せます。

## 実装済み adapter

- `jumpplus`
- `tonarinoyj`
- `comicdays`
- `sundaywebry`
- `magapoke`
- `ynjn` (manga-only discovery、`/gravure/` 除外、label/free 導線 + episode 一覧)
- `comicwalker` (検索一覧 + detail API から作品メタと最新 episode を補完)
- `younganimal`
- `yanmaga`
- `mangaone` (連載一覧 API + `viewer/chapter_list` から work / 最近の chapter 群を取得)

## セットアップ

1. 環境変数を用意します。

```bash
cp .env.example .env
```

2. `APP_PASSWORD_HASH` を bcrypt で作成します。

```bash
node -e "require('bcryptjs').hash('your-password', 10).then(v => console.log(v))"
```

3. 依存を入れます。

```bash
npm install
```

4. Prisma client を生成し、DB を作ります。

```bash
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
```

5. 起動します。

```bash
npm run dev
```

## 環境変数

- `APP_PASSWORD_HASH`: 開発・移行用パスワードログインの bcrypt hash
- `APP_DEV_PASSWORD`: 開発用の平文パスワード。ローカル確認用で、本番では未設定推奨
- `DATABASE_URL`: PostgreSQL の接続先
- `SESSION_SECRET`: セッション署名キー
- `APP_TIMEZONE`: 既定タイムゾーン。既定は `Asia/Tokyo`
- `DAY_BOUNDARY_HOUR`: 日付境界時刻。既定は `4`
- `CRON_SCHEDULE`: 定期同期 cron。既定は `*/30 * * * *`
- `EMBEDDED_CRON_ENABLED`: app process 内で `node-cron` を動かすか。既定は `false`
- `BASE_URL`: 公開 URL
- `APP_OWNER_EMAIL`: 初回 owner user の email
- `APP_OWNER_NAME`: 初回 owner user の表示名
- `GOOGLE_CLIENT_ID`: Google OAuth client id
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `GOOGLE_AUTH_ALLOWED_EMAILS`: ログインを許可する email の comma-separated list。未設定時は owner email のみ許可
- `GOOGLE_AUTH_ALLOWED_DOMAINS`: ログインを許可する domain の comma-separated list
- `PASSWORD_LOGIN_ENABLED`: パスワードログインを残すか。既定は `true`

## 起動方法

### ローカル

```bash
npm run dev
```

### Docker

```bash
docker compose up --build
```

初回起動時に `postgres` が立ち上がり、`app` は `prisma migrate deploy` 後に起動します。

## 同期方法

- UI の `手動同期` ボタン
- API: `POST /api/private/sync/run`
- CLI: `npm run sync:once`
- 自動同期:
  - 開発用に app 内 cron を使うなら `EMBEDDED_CRON_ENABLED=true`
  - 本番は `Cloud Scheduler -> Cloud Run Jobs` を推奨

Cloud Run 本番では、`POST /api/private/sync/run` は web service 内で全サイト同期を抱えず、site ごとの Cloud Run Job を起動してすぐ返します。

### 同期速度の調整

同期は上流サイトへのアクセス、DB 保存、サムネイル preview の後追い取得に分かれます。各 sync の `SyncRun.statsJson.timingMs` に `adapter / persist / snapshot / total` を保存しているので、遅いときはまずここを見ます。

調整用の環境変数:

- `SOURCE_FETCH_TIMEOUT_MS`: adapter / preview fetch の 1 リクエスト timeout。既定は `15000`
- `PREVIEW_BACKFILL_LIMIT`: 1 回の site sync で後追い取得する preview 画像 URL の最大件数。既定は `16`
- `PREVIEW_BACKFILL_CONCURRENCY`: preview 後追い取得の並列数。既定は `4`
- `PREVIEW_BACKFILL_COOLDOWN_HOURS`: preview 取得失敗後、同じ release を再試行しない時間。既定は `24`
- `YNJN_THUMBNAIL_SYNC_LIMIT`: `ynjn` の thumbnail 補完対象 work 数。既定は `120`
- `YNJN_EPISODE_SYNC_LIMIT`: `ynjn` の episode 補完対象 work 数。既定は `40`
- `YNJN_EPISODES_PER_TITLE_LIMIT`: `ynjn` の 1 work あたり保存する episode 数。既定は `3`

開発中にとにかく速く回したい場合は、一時的に `PREVIEW_BACKFILL_LIMIT=0` にするとサムネイル後追い取得を止められます。本番でも Cloud Run service の手動同期は Job をキューするだけなので、ユーザーの画面リクエスト内で重い同期処理を待たせない設計です。

### クラウド料金の抑え方

少人数運用で一番効きやすい固定費は Cloud SQL です。Cloud Run service は min instances なしなら比較的小さく、Cloud Run Jobs は同期頻度と実行時間に比例します。

まずは低コスト設定を推奨します。

```bash
export PROJECT_ID="your-project-id"
export REGION="asia-northeast1"

# 古い一括 sync scheduler が残っている場合は止める
./scripts/pause-legacy-scheduler.sh

# まだ実運用前なら自動同期は止めて、必要なときだけ手動で流す。
./scripts/pause-sync-schedulers.sh
./scripts/run-sync-jobs-once.sh

# さらに削るなら scheduler job 自体を削除。あとで deploy-scheduler.sh で再作成可能。
./scripts/delete-sync-schedulers.sh
./scripts/delete-legacy-scheduler.sh

# 自動同期を戻すなら、まずは 12 時間ごとくらいで十分。
SYNC_INTERVAL_MINUTES=720 ./scripts/deploy-scheduler.sh
./scripts/resume-sync-schedulers.sh

# 2 時間ごと。
SYNC_INTERVAL_MINUTES=120 ./scripts/deploy-scheduler.sh

# もう少し新鮮さが欲しくなったら 60 分ごと。
SYNC_INTERVAL_MINUTES=60 ./scripts/deploy-scheduler.sh
```

live app が一時的に使えなくなってもよいなら、Cloud SQL も止めるとさらに下げられます。

```bash
./scripts/stop-cloud-sql.sh
```

戻すとき:

```bash
./scripts/start-cloud-sql.sh
```

予算アラートも作れます。

```bash
export PROJECT_ID="your-project-id"

# 既定は 30 USD/月。50%, 80%, 100%, forecasted 100% で通知。
./scripts/create-budget-alert.sh

# もっと厳しめに見るなら
BUDGET_AMOUNT=10 ./scripts/create-budget-alert.sh
```

詳しくは [docs/deploy-gcp.md](docs/deploy-gcp.md) の `Cost / Budget` を参照してください。
無料寄りの公開デモやソース公開前チェックは [docs/cost-and-public-release.md](docs/cost-and-public-release.md) にまとめています。

## private / public-safe

- private route: `/`
- public-safe route: `/public`
- private API: `/api/private/...`
- public-safe API: `/api/public/...`

public-safe は private のレスポンスを削る実装ではなく、`lib/queries/public.ts` の whitelist 変換で別構築しています。画像・本文・説明文・既読状態・フォロー状態・優先度は出しません。

## 画面

- `/login`
- `/`
- `/discover`
- `/library`
- `/search`
- `/settings`
- `/public`

## データモデル

`prisma/schema.prisma` に以下の中心モデルを実装しています。

- `User`
- `AuthIdentity`
- `Session`
- `UserSetting`
- `Site`
- `Work`
- `Release`
- `UserWorkPref`
- `UserReleaseState`
- `SyncRun`
- `AppSetting` (shared snapshot や app-wide housekeeping 用)

## Cloud Run / Cloud SQL へ広げる前提

このリポジトリは、次の段階として以下を想定しています。

- Web: `Cloud Run`
- DB: `Cloud SQL for PostgreSQL`
- 定期同期: `Cloud Scheduler -> sync endpoint` か `Cloud Run Jobs`

今回の段階で入っている土台:

- SQLite 依存をやめて PostgreSQL 前提に変更
- Google OAuth login と email / domain allowlist
- session は DB-backed token で管理し、cookie に userId を直接入れない
- sync は shared data を更新し、ユーザー状態は follow 中ユーザーへ fan-out する
- private の見た目設定は `UserSetting` に保存し、ユーザーごとに持てる
- owner/admin だけが同期実行・サイト全体 ON/OFF を変更できる

まだ次段で必要になるもの:

- invite 管理 UI
- web と sync worker の完全分離
- rate limit / audit log / backup / monitoring

## 無料寄りの公開版

動的な private dashboard とは別に、常設サーバーなしで公開できる metadata-only 静的版も用意しています。

```bash
npm run sync:once
npm run export:public-static
```

出力先は `public-out/` です。GitHub Pages 用には `.github/workflows/free-public-pages.yml` があり、1日1回だけ一時 PostgreSQL へ同期して静的 HTML/JSON を公開します。

この静的版のフォローは `localStorage` に保存する端末内機能です。ログインなしで無料に近く運用できますが、端末間同期や複数ユーザーのサーバー側フォロー管理はできません。Google ログイン付きのフォロー・既読管理が必要な場合は、Cloud Run + Postgres などの動的構成を使います。

GitHub Pages への出し方は [docs/free-public-pages.md](docs/free-public-pages.md) に手順を分けています。

## 公開前チェック

リポジトリを公開する前に、最低限これを通します。

```bash
git status --short
./scripts/audit-public-release.sh
npm run lint
npm test
npm run build
```

詳しくは [docs/public-release-checklist.md](docs/public-release-checklist.md) を参照してください。

### Cloud Run で Prisma を使うときの注意

- Cloud Run の実行環境は `debian-openssl-3.0.x` 系になることがあります。
- Prisma Client の `binaryTargets` に `debian-openssl-3.0.x` を入れておかないと、deploy 自体は通っても runtime で `Query Engine` が見つからず 500 になることがあります。
- このリポジトリでは `prisma/schema.prisma` の generator に `["native", "debian-openssl-3.0.x"]` を入れています。

## GCP で動かす最短手順

詳しい実行順メモは [docs/deploy-gcp.md](docs/deploy-gcp.md) にまとめています。

GCP 版は Google login / follow / read state をサーバー側に持つ動的運用向けです。無料寄り公開だけなら [docs/free-public-pages.md](docs/free-public-pages.md) を使う方が軽いです。

前提:

- `Cloud Run`
- `Cloud SQL for PostgreSQL`
- `Artifact Registry`
- `Secret Manager`
- `Cloud Scheduler`

が有効化済みであること。

### 1. 自分で決める値

最初に自分で決めるのはこの4つだけです。

- `DB_PASS`: Cloud SQL user `allmanga` のパスワード
- `LOGIN_PASSWORD`: 開発・移行用パスワード
- `OWNER_EMAIL`: 初回 owner user のメールアドレス
- `OWNER_NAME`: owner の表示名
- `GOOGLE_CLIENT_ID`: Google OAuth client id
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret

### 2. Secret Manager に入れる値

このアプリは Cloud Run 側で以下の secret を参照します。

- `allmanga-database-url`
- `allmanga-session-secret`
- `allmanga-password-hash`
- `allmanga-owner-email`
- `allmanga-owner-name`
- `allmanga-internal-sync-token`
- `allmanga-google-client-id` (Google login を使う場合)
- `allmanga-google-client-secret` (Google login を使う場合)
- `allmanga-google-allowed-emails` (任意)
- `allmanga-google-allowed-domains` (任意)

`allmanga-internal-sync-token` は `Cloud Scheduler -> /api/internal/sync/run` 用です。
Google OAuth の redirect URI は `${BASE_URL}/api/auth/google/callback` です。Cloud Run URL が決まったら、Google Cloud Console の OAuth client に `https://...run.app/api/auth/google/callback` を登録してください。

### 3. Cloud Run へデプロイ

必要な環境変数:

- `PROJECT_ID`
- `REGION`
- `INSTANCE_CONNECTION_NAME`
- `SERVICE_ACCOUNT_EMAIL`

例:

```bash
export PROJECT_ID="your-project-id"
export REGION="asia-northeast1"
export INSTANCE_CONNECTION_NAME="your-project-id:asia-northeast1:allmanga-db"
export SERVICE_ACCOUNT_EMAIL="allmanga-run@${PROJECT_ID}.iam.gserviceaccount.com"
```

デプロイ:

```bash
./scripts/deploy-cloud-run.sh
```

このスクリプトは:

- `gcloud builds submit` でイメージを build
- `Cloud Run` へ deploy
- `Cloud SQL` を attach
- Secret Manager から環境変数を注入
- デプロイ後に `BASE_URL` を service URL へ更新

をまとめて行います。

補足:

- Cloud Run ではコンテナが `0.0.0.0:$PORT` で listen する必要があります。
- このリポジトリの `Dockerfile` は Cloud Run 向けに `next start --hostname 0.0.0.0 --port ${PORT:-8080}` で起動します。

### 4. 同期 job をデプロイする

同期は Cloud Run service の HTTP endpoint で重く抱えず、Cloud Run Jobs へ切り出すのを本番の基本にしています。

```bash
./scripts/deploy-sync-jobs.sh
```

このスクリプトは:

- site ごとの Cloud Run Job を作成または更新
- job runtime に Cloud SQL / Secret Manager を接続
- Cloud Scheduler と web service の手動同期ボタンがその job を起動できるよう `roles/run.invoker` を付与

をまとめて行います。

### 5. 定期同期を作る

```bash
export PROJECT_ID="your-project-id"
export REGION="asia-northeast1"
```

作成または更新:

```bash
./scripts/deploy-scheduler.sh
```

このスクリプトは `Cloud Scheduler` から Cloud Run Jobs API を叩く job を site ごとに作ります。
1 リクエストで全サイト同期すると timeout しやすいため、30 分ごとに数分ずつずらして site 単位で同期します。

### 6. 初回同期をまとめて流す

```bash
export REGION="asia-northeast1"
./scripts/run-sync-jobs-once.sh
```

これで site ごとの Cloud Run Job を 1 回ずつ実行できます。デフォルトは 4 並列です。
上流サイトと DB への負荷を見ながら、必要なら並列数を変えられます。

```bash
SYNC_JOB_PARALLELISM=6 ./scripts/run-sync-jobs-once.sh
```

### 7. アーキテクチャの考え方

- 表示リクエストは shared snapshot + user state の薄い合成に寄せる
- sync は `Release` を shared data に保存し、follow 中ユーザーへ `UserReleaseState` を fan-out する
- private settings は `UserSetting` に保存する
- app 内 cron は開発用で、クラウド本番では `EMBEDDED_CRON_ENABLED=false` を推奨

## adapter の増やし方

1. `lib/sources/<siteId>/index.ts` を追加
2. `SourceAdapter` interface に沿って `sync()` を実装
3. `lib/sources/registry.ts` に descriptor と adapter を登録
4. 正規化時に `canonicalUrl`, `sourceType`, `contentKind`, `rawBadgeText` をできるだけ埋める
5. 漫画以外の導線は `isExcludedUrl()` などで早めに除外する

## semantic classifier

`lib/classifier/index.ts` で以下を実装しています。

- `main_episode`
- `side_story`
- `illustration`
- `hiatus_illustration`
- `promotion`
- `announcement`
- `oneshot_discovery`
- `unknown`

根拠は `semanticSignals` として保存します。Jump+ の badge `イラスト` は `illustration` に固定しています。

## import / export

- export: `GET /api/private/settings/export`
- import: `POST /api/private/settings/import`

対象:

- follows
- user prefs
- read states
- manual overrides

## テスト

```bash
npm test
```

```bash
npm run verify:smoke
```

```bash
npm run verify:sources
```

含まれるテスト:

- unit: classifier / canonicalization / lane transition / work card aggregation
- integration: normalize -> classify -> persist / manual override 保持 / follow baseline
- UI: work card の主要操作 / public-safe whitelist
- smoke: build 済み app を専用ポートで自前起動し、private / public / API の主要導線を GUI なしで検証
- source verification: site ごとの work / release 件数、release/work coverage、required sourceType、latest sync を採点し、薄い adapter や壊れた収集を自動検知
- source verification は site ごとの実 upstream 導線に合わせて `required sourceType` と最小 sourceType 件数を持つ。例として `comicwalker` は `work_page` が一定数なければ fail にする
- `mangaone` は `work_page` release が十分に取れているかも検査し、最新1件だけに退化した場合は fail にする
- stale work reconciliation: adapter 改善で canonical work が変わった場合でも、generic な誤 work や同タイトルの古い work を sync 時に整理
- fallback release reconciliation: 同じ作品に `work_page` episode が入ったら、古い `contentKind=work` fallback release は sync 時に整理

## 注意点

- 本文・画像・OGP は保存も再配信もしていません
- 各 adapter は公式導線優先・metadata-only 前提です
- 一部サイトは HTML 構造変更に弱いため、`site.enabled` の kill switch で停止できます
- Node / npm が必要です
