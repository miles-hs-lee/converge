# Playwright CLI Smoke Checks

This repo uses the Codex Playwright *CLI-first* workflow (not `@playwright/test`).

## Prereqs

- Node.js + npm (for `npx`)
- First run may download `@playwright/cli` and browser binaries.

## Run

Start the app (local):

```bash
npm run dev
```

In another terminal, run the smoke script:

```bash
# simplest
bash scripts/playwright/smoke.sh http://localhost:3000

# assert a visible marker exists (recommended)
EXPECT_SELECTOR='[data-testid="page-onboarding"]' bash scripts/playwright/smoke.sh http://localhost:3000

# headed mode (useful when debugging)
HEADED=1 EXPECT_SELECTOR='[data-testid="page-onboarding"]' bash scripts/playwright/smoke.sh http://localhost:3000
```

Production target:

```bash
BASE_URL='https://converge-teal.vercel.app/' EXPECT_SELECTOR='[data-testid="page-onboarding"]' npm run verify:smoke
```

Artifacts are written under:

```text
output/playwright/<label>-<timestamp>/
```

## Notes

- If the wrapper path is different on your machine, set `PWCLI`:

```bash
PWCLI="$HOME/.codex/skills/playwright/scripts/playwright_cli.sh" bash scripts/playwright/smoke.sh
```

- If `EXPECT_SELECTOR` fails, re-run with `HEADED=1` and tune the selector to something stable (a `data-testid` is best).
