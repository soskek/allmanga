#!/bin/sh
set -eu

: "${PROJECT_ID:?PROJECT_ID is required}"
: "${REGION:?REGION is required}"
: "${JOB_PREFIX:=allmanga-sync}"
: "${TIME_ZONE:=Asia/Tokyo}"
: "${SYNC_INTERVAL_MINUTES:=60}"
: "${GCLOUD_BIN:=gcloud}"

PROJECT_NUMBER="$("${GCLOUD_BIN}" projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
SCHEDULER_SERVICE_ACCOUNT_EMAIL="${SCHEDULER_SERVICE_ACCOUNT_EMAIL:-${PROJECT_NUMBER}-compute@developer.gserviceaccount.com}"

SITE_IDS="jumpplus tonarinoyj comicdays sundaywebry magapoke ynjn comicwalker younganimal mangaone yanmaga"
OFFSETS="0 3 6 9 12 15 18 21 24 27"

case "${SYNC_INTERVAL_MINUTES}" in
  30|60|120|720) ;;
  *)
    echo "SYNC_INTERVAL_MINUTES must be one of: 30, 60, 120, 720" >&2
    exit 1
    ;;
esac

set -- ${OFFSETS}

for SITE_ID in ${SITE_IDS}; do
  MINUTE="$1"
  shift
  case "${SYNC_INTERVAL_MINUTES}" in
    30)
      SECOND_MINUTE=$((MINUTE + 30))
      SCHEDULE="${MINUTE},${SECOND_MINUTE} * * * *"
      ;;
    60)
      SCHEDULE="${MINUTE} * * * *"
      ;;
    120)
      SCHEDULE="${MINUTE} */2 * * *"
      ;;
    720)
      SCHEDULE="${MINUTE} */12 * * *"
      ;;
  esac
  JOB_NAME="${JOB_PREFIX}-${SITE_ID}"
  RUN_URL="https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/jobs/${JOB_NAME}:run"

  if "${GCLOUD_BIN}" scheduler jobs describe "${JOB_NAME}" --location "${REGION}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
    echo "==> Updating scheduler job ${JOB_NAME}"
    "${GCLOUD_BIN}" scheduler jobs update http "${JOB_NAME}" \
      --location "${REGION}" \
      --project "${PROJECT_ID}" \
      --schedule "${SCHEDULE}" \
      --time-zone "${TIME_ZONE}" \
      --uri "${RUN_URL}" \
      --http-method POST \
      --update-headers "Content-Type=application/json" \
      --message-body "{}" \
      --oauth-service-account-email "${SCHEDULER_SERVICE_ACCOUNT_EMAIL}"
  else
    echo "==> Creating scheduler job ${JOB_NAME}"
    "${GCLOUD_BIN}" scheduler jobs create http "${JOB_NAME}" \
      --location "${REGION}" \
      --project "${PROJECT_ID}" \
      --schedule "${SCHEDULE}" \
      --time-zone "${TIME_ZONE}" \
      --uri "${RUN_URL}" \
      --http-method POST \
      --headers "Content-Type=application/json" \
      --message-body "{}" \
      --oauth-service-account-email "${SCHEDULER_SERVICE_ACCOUNT_EMAIL}"
  fi
done

echo "==> Scheduler ready"
