#!/bin/sh
set -eu

PATTERN='(AIza[0-9A-Za-z_-]{20,}|ya29\.|-----BEGIN [A-Z ]*PRIVATE KEY-----|xox[baprs]-[0-9A-Za-z-]+|gh[pousr]_[0-9A-Za-z_]{30,}|sk-[0-9A-Za-z_-]{20,}|postgresql://[^[:space:]"]+:[^[:space:]"]+@[^[:space:]"]+\.(run|google|cloud|com|net|jp)[^[:space:]"]*|billingAccounts/[0-9A-Fa-f-]{6,}|/Users/[^[:space:]]+|allmanga-[a-z0-9-]+\.asia-northeast1\.run\.app|allmanga-[a-z0-9-]+-[a-z]+\.a\.run\.app)'

echo "==> Checking tracked files for public-release sensitive patterns"
FINDINGS="$(git grep -n -I -E "${PATTERN}" -- ':!package-lock.json' ':!scripts/audit-public-release.sh' | grep -v 'allmanga-xxxxxxxxxx' || true)"
if [ -n "${FINDINGS}" ]; then
  printf '%s\n' "${FINDINGS}"
  echo
  echo "Potential public-release findings above. Review each hit before publishing." >&2
  exit 1
fi

echo "==> Checking ignored local files that must not be published"
find . -maxdepth 3 \( -name '.env' -o -name '.env.*' -o -name '*.pem' -o -name '*.key' -o -name '*.p12' -o -name '*.db' -o -name '*.sqlite' \) \
  -not -path './.git/*' \
  -not -name '.env.example' \
  -print

echo "==> Public-release audit passed for tracked files"
