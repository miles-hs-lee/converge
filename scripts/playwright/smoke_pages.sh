#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

BASE_DOMAIN="${BASE_DOMAIN:-https://converge-teal.vercel.app}"
HEADED="${HEADED:-0}"
TIMEOUT_MS="${TIMEOUT_MS:-15000}"

run_one() {
  local name="$1"
  local path="$2"
  local expect="$3"

  echo "==> ${name} ${BASE_DOMAIN}${path}"
  LABEL="prod-${name}" \
    HEADED="$HEADED" \
    TIMEOUT_MS="$TIMEOUT_MS" \
    EXPECT_SELECTOR="$expect" \
    bash "$ROOT/scripts/playwright/smoke.sh" "${BASE_DOMAIN}${path}"
}

# Public pages
run_one "home" "/" '[data-testid="page-onboarding"]'
run_one "onboarding" "/onboarding" '[data-testid="page-onboarding"]'
run_one "login" "/login" '[data-testid="page-login"]'

# Auth-gated pages: accept either the login page (logged out) or the app shell (logged in).
run_one "calendar" "/calendar" '[data-testid="page-login"],[data-testid="top-nav"]'
run_one "people" "/people" '[data-testid="page-login"],[data-testid="top-nav"]'
run_one "settings" "/settings" '[data-testid="page-login"],[data-testid="top-nav"]'

