# GCP Deploy Flow

このアプリを Google Cloud で常設運用するときの、実行順メモです。

## どの GCP 版か

GCP で動かす場合は、目的に応じて運用モードを分けます。

| Mode | Web | DB | Sync | Cost | Use case |
| --- | --- | --- | --- | --- | --- |
| `managed-private` | Cloud Run | Cloud SQL | Cloud Scheduler + Cloud Run Jobs | 高め | Google login / follow / read state をちゃんと使う |
| `low-frequency-managed` | Cloud Run | Cloud SQL | 1日1回から12時間ごと | 中 | 少人数で常設しつつコストを抑える |
| `manual-managed` | Cloud Run | Cloud SQL | 手動のみ | 中-低 | まだ試作中。必要な時だけ同期 |
| `static-public-free` | GitHub Pages 等 | なし | GitHub Actions 1日1回 | ほぼ無料寄り | 公開用 metadata-only ページ |

このドキュメントは `managed-private` / `low-frequency-managed` 向けです。無料寄りの静的公開は [free-public-pages.md](free-public-pages.md) を使います。

最初におすすめする GCP 設定:

- Cloud Run service: min instances なし
- Cloud SQL: 起動したままなら一番の固定費。使わない期間は stop / delete を検討
- Sync: 最初は 1日1回か 12時間ごと
- Scheduler: 実運用前は delete でもよい
- Preview backfill: sync job では控えめ。必要ならあとで増やす

## 前提

- `PROJECT_ID`: GCP project id
- `REGION`: 例 `asia-northeast1`
- Cloud Billing が有効
- 次の API が有効
  - `run.googleapis.com`
  - `sqladmin.googleapis.com`
  - `artifactregistry.googleapis.com`
  - `cloudbuild.googleapis.com`
  - `secretmanager.googleapis.com`
  - `cloudscheduler.googleapis.com`

## 1. gcloud 初期化

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
gcloud config set run/region asia-northeast1
```

## 2. Artifact Registry

```bash
gcloud artifacts repositories create allmanga \
  --repository-format=docker \
  --location=asia-northeast1 \
  --description="AllManga containers"
```

## 3. Cloud SQL (PostgreSQL)

```bash
gcloud sql instances create allmanga-db \
  --database-version=POSTGRES_16 \
  --edition=ENTERPRISE \
  --cpu=1 \
  --memory=3840MiB \
  --region=asia-northeast1

gcloud sql databases create allmanga --instance=allmanga-db

gcloud sql users create allmanga \
  --instance=allmanga-db \
  --password='YOUR_DB_PASSWORD'
```

接続名:

```bash
gcloud sql instances describe allmanga-db --format='value(connectionName)'
```

## 4. Secret Manager

必要な secret:

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

例:

```bash
printf '%s' "$DATABASE_URL" | gcloud secrets create allmanga-database-url --data-file=-
printf '%s' "$SESSION_SECRET" | gcloud secrets create allmanga-session-secret --data-file=-
printf '%s' "$APP_PASSWORD_HASH" | gcloud secrets create allmanga-password-hash --data-file=-
printf '%s' "$OWNER_EMAIL" | gcloud secrets create allmanga-owner-email --data-file=-
printf '%s' "$OWNER_NAME" | gcloud secrets create allmanga-owner-name --data-file=-
printf '%s' "$INTERNAL_SYNC_TOKEN" | gcloud secrets create allmanga-internal-sync-token --data-file=-
```

Google login を使う場合:

```bash
printf '%s' "$GOOGLE_CLIENT_ID" | gcloud secrets create allmanga-google-client-id --data-file=-
printf '%s' "$GOOGLE_CLIENT_SECRET" | gcloud secrets create allmanga-google-client-secret --data-file=-
printf '%s' "$OWNER_EMAIL" | gcloud secrets create allmanga-google-allowed-emails --data-file=-
```

許可する人を増やす場合は、comma-separated で email を足します。

```bash
printf '%s' "you@example.com,friend@example.com" | gcloud secrets versions add allmanga-google-allowed-emails --data-file=-
```

更新するとき:

```bash
printf '%s' "$VALUE" | gcloud secrets versions add SECRET_NAME --data-file=-
```

## 5. Cloud Run service account

```bash
gcloud iam service-accounts create allmanga-run \
  --display-name="AllManga Cloud Run"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:allmanga-run@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:allmanga-run@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 6. Cloud Run deploy

必要な公開値だけ export します。secret の中身は shell に置かなくて大丈夫です。

```bash
export PROJECT_ID="YOUR_PROJECT_ID"
export REGION="asia-northeast1"
export INSTANCE_CONNECTION_NAME="$(gcloud sql instances describe allmanga-db --format='value(connectionName)')"
export SERVICE_ACCOUNT_EMAIL="allmanga-run@${PROJECT_ID}.iam.gserviceaccount.com"
```

deploy:

```bash
./scripts/deploy-cloud-run.sh
```

Google OAuth の redirect URI は Cloud Run URL の `/api/auth/google/callback` です。初回 deploy 後に出る service URL を Google Cloud Console の OAuth client に登録してください。

例:

```text
https://allmanga-xxxxxxxxxx.asia-northeast1.run.app/api/auth/google/callback
```

Google login が動いたら、本番ではパスワード fallback を閉じられます。

```bash
PASSWORD_LOGIN_ENABLED=false ./scripts/deploy-cloud-run.sh
```

このスクリプトは:

- container build
- Cloud Run deploy
- Cloud SQL attach
- Secret Manager から env 注入
- `BASE_URL` 更新

をまとめて行います。

## 7. Sync jobs をデプロイ

```bash
./scripts/deploy-sync-jobs.sh
```

このスクリプトは:

- `allmanga-sync-<siteId>` 形式の Cloud Run Job を site ごとに作成
- job から Cloud SQL と Secret Manager を使えるよう設定
- Cloud Scheduler 用 service account と web service account に `roles/run.invoker` を付与

します。

DB migration は Cloud Run service の起動時にだけ実行します。sync job は同期処理だけを実行し、job 起動ごとの余計な migration 待ちを避けます。
UI の同期ボタンも Cloud Run 上ではこの job を起動するだけで、web request 内で全サイト同期を待ちません。

## 8. Cloud Scheduler

```bash
./scripts/deploy-scheduler.sh
```

このスクリプトは Cloud Run service endpoint ではなく、Cloud Run Jobs API に対して scheduler を site ごとに作ります。
同期は 1 リクエストで全サイトではなく、site ごとに stagger します。

まだ実運用前なら、自動同期を止めて手動運用に寄せるのが一番安いです。

```bash
./scripts/pause-sync-schedulers.sh
./scripts/run-sync-jobs-once.sh
```

自動同期を戻す場合も、最初は 12 時間ごとで十分です。より新鮮さを優先する場合だけ 60 分や 30 分へ上げます。

```bash
# 1 日 1 回。公開デモや低負荷運用の初期値。
SYNC_INTERVAL_MINUTES=1440 ./scripts/deploy-scheduler.sh
./scripts/resume-sync-schedulers.sh

# かなり低コスト寄り。
SYNC_INTERVAL_MINUTES=720 ./scripts/deploy-scheduler.sh
./scripts/resume-sync-schedulers.sh

# 2 時間ごと。
SYNC_INTERVAL_MINUTES=120 ./scripts/deploy-scheduler.sh

# 少人数の常用で鮮度が欲しくなったら 60 分ごと。
SYNC_INTERVAL_MINUTES=60 ./scripts/deploy-scheduler.sh

# 以前の高頻度設定。
SYNC_INTERVAL_MINUTES=30 ./scripts/deploy-scheduler.sh
```

古い `/api/internal/sync/run` 向けの一括 scheduler を作っていた場合は、site 別 job と重複するため止めます。

```bash
./scripts/pause-legacy-scheduler.sh
```

### 同期頻度の目安

| Frequency | Recommendation |
| --- | --- |
| 手動のみ | 開発中・コスト最小 |
| 1日1回 | 公開デモ、軽い個人運用 |
| 12時間ごと | 少人数で毎日見る |
| 2-6時間ごと | 自分用 inbox として実用寄り |
| 30-60分ごと | コストと上流負荷を許容できる場合だけ |

漫画更新の性質上、最初から30分ごとにする必要は薄いです。ユーザーが増えるまでは 1日1回から始め、足りなくなったら 12時間ごと、6時間ごとへ上げるのが安全です。

## 9. 初回同期をまとめて流す

```bash
export REGION="asia-northeast1"
./scripts/run-sync-jobs-once.sh
```

デフォルトでは 4 並列で site ごとの job を実行します。もっと攻めたい場合は変更できますが、上流サイトと Cloud SQL への負荷を見ながら上げてください。

```bash
SYNC_JOB_PARALLELISM=6 ./scripts/run-sync-jobs-once.sh
```

## 10. 手動で 1 サイトだけ同期

```bash
gcloud run jobs execute allmanga-sync-jumpplus \
  --region asia-northeast1 \
  --wait
```

## 10.1 デプロイ後の最小確認

Cloud Run URL を取得:

```bash
SERVICE_URL="$(gcloud run services describe allmanga \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --format='value(status.url)')"
echo "$SERVICE_URL"
```

login page が返るか:

```bash
curl -fsSI "$SERVICE_URL/login" | head
```

public-safe API が返るか:

```bash
curl -fsS "$SERVICE_URL/api/public/recent" | head -c 1000
```

同期 job があるか:

```bash
gcloud run jobs list \
  --region "$REGION" \
  --project "$PROJECT_ID"
```

Scheduler が有効か:

```bash
gcloud scheduler jobs list \
  --location "$REGION" \
  --project "$PROJECT_ID"
```

private dashboard は Google OAuth allowlist か fallback password でログインして確認します。

## 10.5 adapter 日付診断

ローカルから upstream を直接見て、site ごとの当日更新候補がどう解釈されるかを確認できます。

```bash
npm run verify:adapter-dates
```

特定 site だけ見る場合:

```bash
npm run verify:adapter-dates -- jumpplus comicdays
```

見るポイント:

- `today`: JST 今日に入る更新候補数
- `withoutPublishedAt`: 日付が取れない episode 候補数
- `future`: 明日以降として解釈された候補数

`ynjn` は公式 API の episode payload に公開日が出ないため、`withoutPublishedAt` が多くなります。
そのため `ynjn` は「今日の更新」へ安全に入れるより、「少し前」や検索/ライブラリで見る扱いに寄せています。

## 11. ログ確認

```bash
gcloud run services logs read allmanga \
  --region asia-northeast1 \
  --project YOUR_PROJECT_ID \
  --limit 150
```

job 側のログは:

```bash
gcloud run jobs executions list --job allmanga-sync-jumpplus --region asia-northeast1
```

## 12. よくある詰まりどころ

- `P1000 Authentication failed`
  - `allmanga-database-url` のパスワードが Cloud SQL user とずれている
- `Query Engine could not be found`
  - Prisma `binaryTargets` が Cloud Run runtime と合っていない
- `/api/internal/sync/run` が 504
  - 全サイト一括同期が重い。Cloud Run Jobs に切り出す
- login 後に `0.0.0.0:8080` へ飛ぶ
  - `BASE_URL` の組み立てが壊れている。再 deploy 後の env を確認

## 13. Cost / Budget

現状のコストで一番効きやすいのは Cloud SQL です。

- `Cloud SQL allmanga-db`
  - `db-custom-1-3840` は常時起動の dedicated-core DB なので、アクセスが少なくても固定費に近いです。
  - 個人・少人数フェーズでは、ここが月額の主因になります。
- `Cloud Run service`
  - min instances なしなら、アクセスが少ない間は小さめです。
- `Cloud Run Jobs`
  - sync job は instance 起動時間で課金されます。
  - site ごと 30 分おきは便利ですが、少人数なら 60 分または 120 分でも十分なことが多いです。
- `Cloud Scheduler`
  - job 数課金です。小さいですが、不要な legacy job は止めます。

まずやる節約:

```bash
export PROJECT_ID="YOUR_PROJECT_ID"
export REGION="asia-northeast1"

./scripts/pause-legacy-scheduler.sh
./scripts/pause-sync-schedulers.sh
SYNC_INTERVAL_MINUTES=60 ./scripts/deploy-scheduler.sh
```

実運用前で live app が壊れてもよいなら、Cloud SQL も止めます。

```bash
./scripts/stop-cloud-sql.sh
```

戻すとき:

```bash
./scripts/start-cloud-sql.sh
```

Cloud SQL を止めても storage は残るため、完全に近い無料化を狙うなら DB dump/export 後に Cloud SQL instance を削除し、必要になったら free/low-cost Postgres や static snapshot 構成へ移すのが現実的です。

完全手動運用なら、Scheduler は pause ではなく delete でも構いません。あとで `deploy-scheduler.sh` で再作成できます。

```bash
./scripts/delete-sync-schedulers.sh
./scripts/delete-legacy-scheduler.sh
```

### GCP 環境を完全に片付ける

GitHub Pages / static snapshot 運用へ寄せて、GCP 版を当面使わない場合は、停止ではなく削除します。Cloud SQL は削除すると DB データも消えるため、必要なら先に dump/export してください。

```bash
export PROJECT_ID="YOUR_PROJECT_ID"
export REGION="asia-northeast1"

# Cloud Run web service
gcloud run services delete allmanga \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --quiet

# Cloud Run sync / check jobs
for job in $(gcloud run jobs list \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --filter='metadata.name:allmanga' \
  --format='value(metadata.name)'); do
  gcloud run jobs delete "$job" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --quiet
done

# Cloud SQL database instance. This removes the remaining DB storage cost too.
gcloud sql instances delete allmanga-db \
  --project "$PROJECT_ID" \
  --quiet

# Container images
gcloud artifacts repositories delete allmanga \
  --location "$REGION" \
  --project "$PROJECT_ID" \
  --quiet

# App secrets
for secret in $(gcloud secrets list \
  --project "$PROJECT_ID" \
  --filter='name:allmanga' \
  --format='value(name)'); do
  gcloud secrets delete "$secret" \
    --project "$PROJECT_ID" \
    --quiet
done

# App service account
gcloud iam service-accounts delete "allmanga-run@${PROJECT_ID}.iam.gserviceaccount.com" \
  --project "$PROJECT_ID" \
  --quiet
```

API 有効化、過去の Cloud Build logs、billing budget、プロジェクト自体はこの手順では消しません。プロジェクトごと不要なら Google Cloud Console から project shutdown するのが最も確実です。

予算アラート:

```bash
export PROJECT_ID="YOUR_PROJECT_ID"

# 既定は 30 USD/月。50%, 80%, 100%, forecasted 100% で通知。
./scripts/create-budget-alert.sh

# 金額を変える場合
BUDGET_AMOUNT=10 ./scripts/create-budget-alert.sh
```

通知先は Cloud Billing の既定 IAM recipient です。個別メールや Slack に飛ばしたい場合は Cloud Monitoring notification channel を作って、budget の通知先に追加します。

将来の代替案:

- Cloud SQL をやめて Supabase / Neon / Railway Postgres などの低額・無料枠寄り DB に移す
- DB を Cloud Run service 内の LiteFS / Turso / SQLite 系に寄せる
- 収集 worker を常時 DB 接続しない設計にして、Firestore / Cloud Storage snapshot 中心にする
- site sync を Cloud Run Jobs ではなく 1 worker job 内で並列実行し、起動回数を減らす
- update freshness をユーザー数に応じて段階化する
