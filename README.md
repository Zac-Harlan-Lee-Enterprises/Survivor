# NFL Survivor League

One pick a week. Three lives. Last one standing wins.

A responsive React + TypeScript survivor-pool app that replaces the commissioner's spreadsheet. The **frontend is a static site built for GitHub Pages** (repository subpath and all); an **optional AWS serverless backend** adds real multi-user persistence, sign-in, headshot uploads and automatic results.

| Mode | Hosting | Data | Who it's for |
|------|---------|------|--------------|
| **Demo / static** (default) | GitHub Pages only | real roster + week 1 picks, synthetic schedule, localStorage overlay (this browser only, not shared) | trying the rules, UI development, sharing a link |
| **Connected** | GitHub Pages + AWS (API Gateway, Lambda, DynamoDB, S3, Cognito) | authoritative, multi-user, audited | the real league |

## What's in the box

- **League Home** — who's still standing at a glance: headshot grid, lives, the bubble, the graveyard, this week's slate, countdown to the next kickoff.
- **Player Dashboard** — big headshot, *Still Alive / On the Bubble / Eliminated / Champion*, lives meter, current pick, countdown, mini leaderboard.
- **Weekly Pick** — polished team cards (opponent, home/away, kickoff, availability), explicit *"You are riding with Green Bay in week 1."* confirmation, change until kickoff, huge tap targets on phones.
- **Leaderboard** — survivors first, then the desaturated **Survivor Graveyard**; champion spotlight with confetti.
- **Season Grid** — the spreadsheet reborn: players × weeks, cells coloured by win/loss/tie/pending/no-pick, elimination markers, hidden picks as locks; expandable cards on mobile.
- **My Season** — available / used / unavailable teams, pick history with outcomes, strategy nudges.
- **Player Profile** — a sports card: headshot, nickname, status, weeks survived, teams remaining.
- **Commissioner** — players & headshots (drag-drop, crop, replace, remove), enter/correct any pick, correct any result, manual schedule entry, league rules, champion decisions, CSV import with a blocking report, full audit log — every change recorded.

Rules engine, import, API and UI are covered by 120+ unit/API tests and 51 Playwright critical-path tests (desktop + mobile), including axe WCAG A/AA checks on every screen.

## Local development

Requirements: Node ≥ 22 (`.nvmrc` says 26), `jq`. No AWS account needed for demo mode.

```bash
bash init.sh                 # npm ci, git hooks, dev server on http://localhost:5891/ (demo mode)
bash init.sh --with-pages    # + production build served exactly like GitHub Pages at http://localhost:5892/Survivor/
bash init.sh --stop
```

Sign in as any league member (no passwords in demo mode); **Zac Harlan** is the commissioner. The demo clock is pinned to the Wednesday before week 1, so the season always opens in the same state: every pick in, nothing kicked off. The commissioner's Settings tab can move the clock forward, and *Reset demo data* wipes localStorage.

Useful scripts (`npm run …`): `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`, `validate` (all of CI), `fixtures:generate`, `import:report`, `api:build`, `knip`.

## Deploying the frontend to GitHub Pages

1. Push to GitHub. In **Settings → Pages → Build and deployment** choose **GitHub Actions**.
2. Merge to `main`. `.github/workflows/deploy-pages.yml` lints, typechecks, tests, builds with the base path derived from the repository name (`owner/Survivor` → `/Survivor/`; `owner.github.io` → `/`), and deploys.
3. Open `https://<owner>.github.io/<repo>/`.

Deep links survive refreshes: routing is hash-based, and a build-time `404.html` rewrites clean URLs like `/Survivor/leaderboard` to `/Survivor/#/leaderboard`. Details: [docs/github-pages.md](docs/github-pages.md).

## Connected mode (AWS)

`infra/template.yaml` (AWS SAM) creates one DynamoDB table, one S3 bucket, a Cognito user pool (Authorization Code + PKCE), an HTTP API with a JWT authorizer and two Lambdas. Deploy, seed the league, set the repository *variables* (`VITE_DATA_MODE=connected`, `VITE_API_BASE_URL`, …) and redeploy the site. Step by step: [docs/aws-connected-mode.md](docs/aws-connected-mode.md). Cost for a small league: a few cents a month.

Every `VITE_*` value is compiled into the public bundle. **No secrets ever go there** — the NFL provider key (if any) lives in AWS.

## NFL data

Demo mode ships the real roster and their real week 1 picks, but the **schedule is synthetic** (flagged `isSynthetic`) — the matchups and kickoff times are placeholders, not the real NFL fixture list, and no results are recorded until you enter them. Connected mode polls a provider on a schedule (`espn` unofficial public scoreboard, or your own implementation of `ExternalNFLProvider`) with idempotent, versioned result processing, and the commissioner can always enter schedules and results by hand. See [docs/nfl-provider.md](docs/nfl-provider.md).

## Migrating from the spreadsheet

Export the sheet as CSV (players as rows, `Week 1…Week 18` columns, `*` after a losing pick), then either paste it into **Commissioner → Import** or run `npm run import:report -- sheet.csv --out report.md`. The report lists ambiguous cells, unknown teams, reused teams, missing picks, bye conflicts and loss markers that contradict results. Nothing is guessed. See [docs/import-report.md](docs/import-report.md).

## Repository map

```
src/domain      pure rules engine, models (zod), CSV import      ← shared with Lambda
src/data        Services interfaces; demo + api adapters
src/app         router (HashRouter), providers, hooks, queries
src/features    the eight experiences
src/components  headshots, lives meter, team monograms, UI primitives
backend/        AWS Lambda API + results sync (esbuild bundles)
infra/          SAM template, seed example
scripts/        fixtures, headshots, static server, import CLI, hooks, guard
tests/          architecture rules, unit, guardrails, Playwright e2e
docs/           deep documentation
```

Agent-facing docs: [AGENTS.md](AGENTS.md).

## Licence / assets

No NFL shield or team logo assets are bundled; teams are rendered as abbreviation monograms in team colours. Sample headshots are generated SVG placeholders.
