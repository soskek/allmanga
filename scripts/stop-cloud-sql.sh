#!/bin/sh
set -eu

: "${PROJECT_ID:?PROJECT_ID is required}"
: "${INSTANCE_NAME:=allmanga-db}"
: "${GCLOUD_BIN:=gcloud}"

echo "==> Stopping Cloud SQL instance ${INSTANCE_NAME}"
echo "==> The app will not be able to serve dynamic/private data until the instance is started again."

"${GCLOUD_BIN}" sql instances patch "${INSTANCE_NAME}" \
  --project "${PROJECT_ID}" \
  --activation-policy=NEVER \
  --quiet

