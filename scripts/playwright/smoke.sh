#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# macOS default TMPDIR can be very long; Playwright CLI uses a UNIX socket under tmp.
# Keep it short to avoid hitting socket path length limits.
export TMPDIR="/tmp"

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
if [[ -z "${PLAYWRIGHT_CLI_SESSION:-}" ]]; then
  # Session name influences the tmp socket filename; keep it short.
  if command -v shasum >/dev/null 2>&1; then
    h="$(printf %s "$LABEL" | shasum -a 1 | awk '{print $1}' | cut -c1-10)"
  else
    h="$(printf %s "$LABEL" | cksum | awk '{print $1}')"
  fi
  export PLAYWRIGHT_CLI_SESSION="cvg-${h}"
fi

if [[ ! -x "$PWCLI" ]]; then
  echo "Error: Playwright CLI wrapper not found/executable: $PWCLI" >&2
  echo "Hint: set PWCLI to the wrapper path (e.g. ~/.codex/skills/playwright/scripts/playwright_cli.sh)" >&2
  exit 1
fi

pw() {
  "$PWCLI" --config "$CONFIG" "$@"
}

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
  pw open "$BASE_URL" "${OPEN_ARGS[@]}" | tee open.log
else
  pw open "$BASE_URL" | tee open.log
fi

# Best-effort "settle"; don't fail the run if networkidle isn't reached.
pw run-code "await page.waitForLoadState('domcontentloaded', { timeout: ${TIMEOUT_MS} })" >/dev/null 2>&1 || true
pw run-code "await page.waitForLoadState('networkidle', { timeout: ${TIMEOUT_MS} }).catch(() => {})" >/dev/null 2>&1 || true

if [[ -n "$EXPECT_SELECTOR" ]]; then
  SEL_JSON="$(node -e 'console.log(JSON.stringify(process.argv[1]))' "$EXPECT_SELECTOR")"
  # `run-code` + `waitForSelector` can be flaky across CLI/runtime versions; use `eval` polling instead.
  # Keep this expression simple; some CLI/runtime combinations behave oddly with IIFEs.
  CHECK_EXPR="Boolean(document.querySelector(${SEL_JSON}))"
  INTERVAL_MS=250
  ITERS=$(( (TIMEOUT_MS + INTERVAL_MS - 1) / INTERVAL_MS ))
  ok=0
  for ((i = 1; i <= ITERS; i++)); do
    out="$(pw eval "$CHECK_EXPR" 2>&1 || true)"
    if echo "$out" | rg -q '^true$'; then
      ok=1
      break
    fi
    sleep 0.25
  done
  if [[ "$ok" != "1" ]]; then
    echo "$out" > wait_for_selector.log
    echo "Error: selector not found/visible within ${TIMEOUT_MS}ms: $EXPECT_SELECTOR" >&2
    exit 1
  fi
  echo "OK" > wait_for_selector.log
fi

pw snapshot | tee snapshot.txt
pw eval "document.title" | tee title.txt

# Artifacts (written to cwd, i.e. output/playwright/<label>-<timestamp>/)
pw screenshot | tee screenshot.log
pw close >/dev/null 2>&1 || true

echo "OK: $BASE_URL -> $OUTDIR"
