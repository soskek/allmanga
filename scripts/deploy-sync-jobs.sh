#!/bin/sh
set -eu

: "${PROJECT_ID:?PROJECT_ID is required}"
: "${REGION:?REGION is required}"
: "${INSTANCE_CONNECTION_NAME:?INSTANCE_CONNECTION_NAME is required}"
: "${SERVICE_ACCOUNT_EMAIL:?SERVICE_ACCOUNT_EMAIL is required}"
: "${REPOSITORY:=allmanga}"
: "${IMAGE_NAME:=allmanga-web}"
: "${JOB_PREFIX:=allmanga-sync}"
: "${TASK_TIMEOUT:=20m}"
: "${SOURCE_FETCH_TIMEOUT_MS:=15000}"
: "${PREVIEW_BACKFILL_LIMIT:=16}"
: "${PREVIEW_BACKFILL_CONCURRENCY:=4}"
: "${PREVIEW_BACKFILL_COOLDOWN_HOURS:=24}"
: "${YNJN_THUMBNAIL_SYNC_LIMIT:=120}"
: "${YNJN_EPISODE_SYNC_LIMIT:=40}"
: "${YNJN_EPISODES_PER_TITLE_LIMIT:=3}"

IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${IMAGE_NAME}:latest"
SITE_IDS="jumpplus tonarinoyj comicdays sundaywebry magapoke ynjn comicwalker younganimal mangaone yanmaga"
SCHEDULER_SERVICE_ACCOUNT_EMAIL="${SCHEDULER_SERVICE_ACCOUNT_EMAIL:-$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')-compute@developer.gserviceaccount.com}"
JOB_ENV_VARS="APP_TIMEZONE=Asia/Tokyo,DAY_BOUNDARY_HOUR=4,EMBEDDED_CRON_ENABLED=false,SOURCE_FETCH_TIMEOUT_MS=${SOURCE_FETCH_TIMEOUT_MS},PREVIEW_BACKFILL_LIMIT=${PREVIEW_BACKFILL_LIMIT},PREVIEW_BACKFILL_CONCURRENCY=${PREVIEW_BACKFILL_CONCURRENCY},PREVIEW_BACKFILL_COOLDOWN_HOURS=${PREVIEW_BACKFILL_COOLDOWN_HOURS},YNJN_THUMBNAIL_SYNC_LIMIT=${YNJN_THUMBNAIL_SYNC_LIMIT},YNJN_EPISODE_SYNC_LIMIT=${YNJN_EPISODE_SYNC_LIMIT},YNJN_EPISODES_PER_TITLE_LIMIT=${YNJN_EPISODES_PER_TITLE_LIMIT}"

for SITE_ID in ${SITE_IDS}; do
  JOB_NAME="${JOB_PREFIX}-${SITE_ID}"
  echo "==> Deploying Cloud Run job ${JOB_NAME}"
  gcloud run jobs deploy "${JOB_NAME}" \
    --image "${IMAGE_URI}" \
    --region "${REGION}" \
    --tasks 1 \
    --parallelism 1 \
    --max-retries 0 \
    --task-timeout "${TASK_TIMEOUT}" \
    --cpu 1 \
    --memory 1Gi \
    --service-account "${SERVICE_ACCOUNT_EMAIL}" \
    --set-cloudsql-instances "${INSTANCE_CONNECTION_NAME}" \
    --set-secrets "DATABASE_URL=allmanga-database-url:latest,SESSION_SECRET=allmanga-session-secret:latest,APP_PASSWORD_HASH=allmanga-password-hash:latest,APP_OWNER_EMAIL=allmanga-owner-email:latest,APP_OWNER_NAME=allmanga-owner-name:latest" \
    --set-env-vars "${JOB_ENV_VARS}" \
    --command sh \
    --args=-lc,"exec npx tsx scripts/run-sync.ts --siteId=${SITE_ID}"

  gcloud run jobs add-iam-policy-binding "${JOB_NAME}" \
    --region "${REGION}" \
    --member "serviceAccount:${SCHEDULER_SERVICE_ACCOUNT_EMAIL}" \
    --role "roles/run.invoker" >/dev/null

  gcloud run jobs add-iam-policy-binding "${JOB_NAME}" \
    --region "${REGION}" \
    --member "serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role "roles/run.invoker" >/dev/null
done

echo "==> Sync jobs ready"
