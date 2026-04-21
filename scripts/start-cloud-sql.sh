#!/bin/sh
set -eu

: "${PROJECT_ID:?PROJECT_ID is required}"
: "${INSTANCE_NAME:=allmanga-db}"
: "${GCLOUD_BIN:=gcloud}"

echo "==> Starting Cloud SQL instance ${INSTANCE_NAME}"

"${GCLOUD_BIN}" sql instances patch "${INSTANCE_NAME}" \
  --project "${PROJECT_ID}" \
  --activation-policy=ALWAYS \
  --quiet

