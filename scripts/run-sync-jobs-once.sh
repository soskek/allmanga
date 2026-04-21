#!/bin/sh
set -eu

: "${REGION:?REGION is required}"
: "${JOB_PREFIX:=allmanga-sync}"
: "${SYNC_JOB_PARALLELISM:=4}"

SITE_IDS="jumpplus tonarinoyj comicdays sundaywebry magapoke ynjn comicwalker younganimal mangaone yanmaga"

case "${SYNC_JOB_PARALLELISM}" in
  ''|*[!0-9]*)
    echo "SYNC_JOB_PARALLELISM must be a positive integer" >&2
    exit 1
    ;;
esac

if [ "${SYNC_JOB_PARALLELISM}" -lt 1 ]; then
  echo "SYNC_JOB_PARALLELISM must be greater than 0" >&2
  exit 1
fi

run_job() {
  SITE_ID="$1"
  JOB_NAME="${JOB_PREFIX}-${SITE_ID}"
  echo "==> Executing ${JOB_NAME}"
  gcloud run jobs execute "${JOB_NAME}" \
    --region "${REGION}" \
    --wait
}

PIDS=""
RUNNING=0
FAILURES=0

wait_for_one() {
  set -- ${PIDS}
  FIRST_PID="$1"
  shift || true
  PIDS="$*"

  if ! wait "${FIRST_PID}"; then
    FAILURES=$((FAILURES + 1))
  fi
  RUNNING=$((RUNNING - 1))
}

echo "==> Executing sync jobs with parallelism ${SYNC_JOB_PARALLELISM}"

for SITE_ID in ${SITE_IDS}; do
  run_job "${SITE_ID}" &
  PIDS="${PIDS} $!"
  RUNNING=$((RUNNING + 1))

  if [ "${RUNNING}" -ge "${SYNC_JOB_PARALLELISM}" ]; then
    wait_for_one
  fi
done

while [ "${RUNNING}" -gt 0 ]; do
  wait_for_one
done

if [ "${FAILURES}" -gt 0 ]; then
  echo "==> ${FAILURES} sync job(s) failed" >&2
  exit 1
fi

echo "==> All sync jobs executed"
