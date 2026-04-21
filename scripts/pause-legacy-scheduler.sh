#!/bin/sh
set -eu

: "${PROJECT_ID:?PROJECT_ID is required}"
: "${REGION:?REGION is required}"
: "${LEGACY_JOB_NAME:=allmanga-sync}"
: "${GCLOUD_BIN:=gcloud}"

if "${GCLOUD_BIN}" scheduler jobs describe "${LEGACY_JOB_NAME}" --location "${REGION}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  echo "==> Pausing legacy scheduler job ${LEGACY_JOB_NAME}"
  "${GCLOUD_BIN}" scheduler jobs pause "${LEGACY_JOB_NAME}" \
    --location "${REGION}" \
    --project "${PROJECT_ID}"
else
  echo "==> Legacy scheduler job ${LEGACY_JOB_NAME} does not exist"
fi
