#!/bin/sh
set -eu

: "${PROJECT_ID:?PROJECT_ID is required}"
: "${BUDGET_AMOUNT:=30}"
: "${BUDGET_DISPLAY_NAME:=AllManga monthly budget}"
: "${GCLOUD_BIN:=gcloud}"

BILLING_ACCOUNT_ID="${BILLING_ACCOUNT_ID:-$("${GCLOUD_BIN}" billing projects describe "${PROJECT_ID}" --format='value(billingAccountName)' | sed 's#billingAccounts/##')}"

if [ -z "${BILLING_ACCOUNT_ID}" ]; then
  echo "Could not resolve billing account for ${PROJECT_ID}" >&2
  exit 1
fi

echo "==> Creating budget ${BUDGET_DISPLAY_NAME} on billing account ${BILLING_ACCOUNT_ID}"
echo "==> Amount: ${BUDGET_AMOUNT}"

"${GCLOUD_BIN}" billing budgets create \
  --billing-account="${BILLING_ACCOUNT_ID}" \
  --display-name="${BUDGET_DISPLAY_NAME}" \
  --budget-amount="${BUDGET_AMOUNT}" \
  --calendar-period=month \
  --filter-projects="projects/${PROJECT_ID}" \
  --threshold-rule=percent=0.50 \
  --threshold-rule=percent=0.80 \
  --threshold-rule=percent=1.00 \
  --threshold-rule=percent=1.00,basis=forecasted-spend
