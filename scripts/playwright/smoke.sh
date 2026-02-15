#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

BASE_URL="${1:-${BASE_URL:-http://localhost:3000}}"
LABEL="${LABEL:-smoke}"
EXPECT_SELECTOR="${EXPECT_SELECTOR:-[data-testid=\"page-onboarding\"]}"
HEADED="${HEADED:-0}"
TIMEOUT_MS="${TIMEOUT_MS:-15000}"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUTDIR="$ROOT/output/playwright/${LABEL}-${STAMP}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PWCLI="${PWCLI:-$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh}"
CONFIG="${CONFIG:-$ROOT/scripts/playwright/playwright-cli.json}"
export PLAYWRIGHT_CLI_SESSION="${PLAYWRIGHT_CLI_SESSION:-converge-${LABEL}}"

if [[ ! -x "$PWCLI" ]]; then
  echo "Error: Playwright CLI wrapper not found/executable: $PWCLI" >&2
  echo "Hint: set PWCLI to the wrapper path (e.g. ~/.codex/skills/playwright/scripts/playwright_cli.sh)" >&2
  exit 1
fi

OPEN_ARGS=()
if [[ "$HEADED" == "1" ]]; then
  OPEN_ARGS+=(--headed)
fi

{
  echo "base_url=$BASE_URL"
  echo "label=$LABEL"
  echo "outdir=$OUTDIR"
  echo "expect_selector=${EXPECT_SELECTOR:-<none>}"
  echo "headed=$HEADED"
  echo "timeout_ms=$TIMEOUT_MS"
  echo "session=$PLAYWRIGHT_CLI_SESSION"
  echo "config=$CONFIG"
} > run.meta

# Keep the flow CLI-first; use run-code only for waiting/assertions that need selectors.
# Bash 3.2 + nounset errors on expanding empty arrays, so guard the expansion.
if ((${#OPEN_ARGS[@]})); then
  "$PWCLI" --config "$CONFIG" open "$BASE_URL" "${OPEN_ARGS[@]}" | tee open.log
else
  "$PWCLI" --config "$CONFIG" open "$BASE_URL" | tee open.log
fi

# Best-effort "settle"; don't fail the run if networkidle isn't reached.
"$PWCLI" run-code "await page.waitForLoadState('domcontentloaded', { timeout: ${TIMEOUT_MS} })" >/dev/null 2>&1 || true
"$PWCLI" run-code "await page.waitForLoadState('networkidle', { timeout: ${TIMEOUT_MS} }).catch(() => {})" >/dev/null 2>&1 || true

if [[ -n "$EXPECT_SELECTOR" ]]; then
  SEL_JSON="$(node -e 'console.log(JSON.stringify(process.argv[1]))' "$EXPECT_SELECTOR")"
  # Fail if the expected UI marker doesn't appear.
  # eslint-disable-next-line no-unused-vars
  "$PWCLI" run-code "await page.waitForSelector(${SEL_JSON}, { timeout: ${TIMEOUT_MS}, state: 'visible' })" | tee wait_for_selector.log
fi

"$PWCLI" snapshot | tee snapshot.txt
"$PWCLI" eval "document.title" | tee title.txt

# Artifacts (written to cwd, i.e. output/playwright/<label>-<timestamp>/)
"$PWCLI" screenshot | tee screenshot.log
"$PWCLI" close >/dev/null 2>&1 || true

echo "OK: $BASE_URL -> $OUTDIR"
