#!/bin/sh
set -eu

: "${PROJECT_ID:?PROJECT_ID is required}"
: "${REGION:?REGION is required}"
: "${SERVICE_NAME:=allmanga}"
: "${REPOSITORY:=allmanga}"
: "${IMAGE_NAME:=allmanga-web}"
: "${INSTANCE_CONNECTION_NAME:?INSTANCE_CONNECTION_NAME is required}"
: "${SERVICE_ACCOUNT_EMAIL:?SERVICE_ACCOUNT_EMAIL is required}"
: "${SOURCE_FETCH_TIMEOUT_MS:=15000}"
: "${PREVIEW_BACKFILL_LIMIT:=16}"
: "${PREVIEW_BACKFILL_CONCURRENCY:=4}"
: "${PREVIEW_BACKFILL_COOLDOWN_HOURS:=24}"
: "${YNJN_THUMBNAIL_SYNC_LIMIT:=120}"
: "${YNJN_EPISODE_SYNC_LIMIT:=40}"
: "${YNJN_EPISODES_PER_TITLE_LIMIT:=3}"
: "${PASSWORD_LOGIN_ENABLED:=true}"

IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${IMAGE_NAME}:latest"
APP_ENV_VARS="APP_TIMEZONE=Asia/Tokyo,DAY_BOUNDARY_HOUR=4,BASE_URL=https://placeholder.invalid,EMBEDDED_CRON_ENABLED=false,GCP_PROJECT_ID=${PROJECT_ID},CLOUD_RUN_REGION=${REGION},SYNC_JOB_PREFIX=allmanga-sync,SOURCE_FETCH_TIMEOUT_MS=${SOURCE_FETCH_TIMEOUT_MS},PREVIEW_BACKFILL_LIMIT=${PREVIEW_BACKFILL_LIMIT},PREVIEW_BACKFILL_CONCURRENCY=${PREVIEW_BACKFILL_CONCURRENCY},PREVIEW_BACKFILL_COOLDOWN_HOURS=${PREVIEW_BACKFILL_COOLDOWN_HOURS},YNJN_THUMBNAIL_SYNC_LIMIT=${YNJN_THUMBNAIL_SYNC_LIMIT},YNJN_EPISODE_SYNC_LIMIT=${YNJN_EPISODE_SYNC_LIMIT},YNJN_EPISODES_PER_TITLE_LIMIT=${YNJN_EPISODES_PER_TITLE_LIMIT},PASSWORD_LOGIN_ENABLED=${PASSWORD_LOGIN_ENABLED}"
APP_SECRETS="DATABASE_URL=allmanga-database-url:latest,SESSION_SECRET=allmanga-session-secret:latest,APP_PASSWORD_HASH=allmanga-password-hash:latest,APP_OWNER_EMAIL=allmanga-owner-email:latest,APP_OWNER_NAME=allmanga-owner-name:latest,INTERNAL_SYNC_TOKEN=allmanga-internal-sync-token:latest"

append_secret_if_exists() {
  ENV_NAME="$1"
  SECRET_NAME="$2"
  if gcloud secrets describe "${SECRET_NAME}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
    APP_SECRETS="${APP_SECRETS},${ENV_NAME}=${SECRET_NAME}:latest"
  fi
}

append_secret_if_exists "GOOGLE_CLIENT_ID" "allmanga-google-client-id"
append_secret_if_exists "GOOGLE_CLIENT_SECRET" "allmanga-google-client-secret"
append_secret_if_exists "GOOGLE_AUTH_ALLOWED_EMAILS" "allmanga-google-allowed-emails"
append_secret_if_exists "GOOGLE_AUTH_ALLOWED_DOMAINS" "allmanga-google-allowed-domains"

echo "==> Building image: ${IMAGE_URI}"
gcloud builds submit --tag "${IMAGE_URI}"

echo "==> Deploying Cloud Run service: ${SERVICE_NAME}"
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE_URI}" \
  --region "${REGION}" \
  --platform managed \
  --port 8080 \
  --allow-unauthenticated \
  --service-account "${SERVICE_ACCOUNT_EMAIL}" \
  --add-cloudsql-instances "${INSTANCE_CONNECTION_NAME}" \
  --set-secrets "${APP_SECRETS}" \
  --set-env-vars "${APP_ENV_VARS}"

SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --format='value(status.url)')"
if [ -z "${SERVICE_URL}" ]; then
  echo "Cloud Run service URL could not be resolved. Deployment likely failed before becoming ready." >&2
  exit 1
fi
echo "==> Updating BASE_URL to ${SERVICE_URL}"
gcloud run services update "${SERVICE_NAME}" \
  --region "${REGION}" \
  --update-env-vars "BASE_URL=${SERVICE_URL}"

echo "==> Done"
