#!/bin/sh
set -eu

: "${PROJECT_ID:?PROJECT_ID is required}"
: "${REGION:?REGION is required}"
: "${JOB_PREFIX:=allmanga-sync}"
: "${GCLOUD_BIN:=gcloud}"

SITE_IDS="jumpplus tonarinoyj comicdays sundaywebry magapoke ynjn comicwalker younganimal mangaone yanmaga"

for SITE_ID in ${SITE_IDS}; do
  JOB_NAME="${JOB_PREFIX}-${SITE_ID}"
  if "${GCLOUD_BIN}" scheduler jobs describe "${JOB_NAME}" --location "${REGION}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
    echo "==> Deleting scheduler job ${JOB_NAME}"
    "${GCLOUD_BIN}" scheduler jobs delete "${JOB_NAME}" \
      --location "${REGION}" \
      --project "${PROJECT_ID}" \
      --quiet
  else
    echo "==> Scheduler job ${JOB_NAME} does not exist"
  fi
done

