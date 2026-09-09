# Architecture

## The four lenses

1. **A fun league experience** — every screen leads with the people (headshots, status, lives) and the drama of the week (countdown, bubble, graveyard).
2. **A deterministic rules engine** — `src/domain` is a pure function of `(snapshot, now)`. Nothing mutable is stored for standings; corrections simply re-evaluate.
3. **A static GitHub Pages frontend** — Vite build, hash routing, configurable base, build-time `404.html`, no server anywhere in the request path.
4. **An optionally connected serverless app** — one Lambda API, one table, one bucket, Cognito, a scheduled sync. Same domain code, same zod schemas.

## Modules and dependency direction

```
features / components / app  →  data/interfaces  →  domain
                                       ↑
                    data/demo  ·  data/api (fetch only in http.ts)
backend/src/routes  →  backend/src/lib  →  domain
```

`tests/architecture/layers.test.ts` enforces the arrows mechanically with actionable failure messages.

## Key decisions

| Decision | Why |
|----------|-----|
| **HashRouter** instead of BrowserRouter | GitHub Pages has no rewrite rules. With hash routing every deep link resolves to `index.html`; a refresh can never 404. `404.html` rewrites clean URLs for links people type. |
| **Base path from config, never assumed** | Project sites live at `/<repo>/`. `build/basePath.ts` normalises `VITE_BASE_PATH` or derives it from `GITHUB_REPOSITORY`; user/org sites resolve to `/`. |
| **Derive, don't store** standings | A single `evaluateSeason` makes commissioner corrections, provider corrections and rule changes trivially consistent and testable. |
| **Same `validatePick` in browser and Lambda** | The UI can be helpful (disabled cards, messages) while the API stays authoritative with the server clock and conditional writes. |
| **Provider-independent game ids** (`<year>-w<ww>-<away>-at-<home>`) | Picks reference games; switching or losing a provider never orphans picks. |
| **Single-table DynamoDB, on demand** | One table, a handful of query patterns, near-zero cost for a small league, no capacity planning. |
| **Presigned S3 POST for headshots, browser-side resize** | No credentials in the browser, no Lambda image processing, S3 enforces type and size; the API re-verifies on finalize. |
| **Cognito Authorization Code + PKCE** | Browser-only OAuth with no client secret; callbacks land on the Pages base URL; API Gateway validates the JWT, the API checks roles in DynamoDB. |
| **`/public/*` anonymous read routes** | HTTP API JWT authorizers reject missing tokens, so read-only routes get a second, unauthenticated path; writes there are refused with 405. |
| **Demo clock pinned** | The season always opens in the same state (week 1 open, every pick in, nothing kicked off) for screenshots and tests; the commissioner can move it forward. |
| **Synthetic schedule, flagged; real roster** | The roster and week 1 picks are real. Schedules and results are never fabricated: the matchups are placeholders (`isSynthetic: true`, banner in the UI) and no result is seeded at all. |

## Data flow

1. `LeagueProvider` loads the league and the viewer-specific season snapshot (`getSeasonSnapshot` — redacted server-side/demo-side).
2. `useEvaluation` runs `evaluateSeason(snapshot, { now })` (re-runs every 30 s or when the demo clock moves).
3. Pages render from `evaluation.standings`, `evaluation.weeks`, and `snapshot.hiddenPicks` (locked-but-hidden picks).
4. Mutations go through the `Services` interfaces; TanStack Query invalidates the snapshot so everything recomputes.

## Explicitly handled situations

See [survivor-rules.md](survivor-rules.md) for the rulebook, plus:

- **Provider outage** — sync errors are reported per week and never block the commissioner (manual schedule + manual results in the Results tab; `POST …/sync` returns 503 with guidance).
- **Duplicate result jobs** — `applyGameResults` is idempotent; `saveGame` is conditional on `resultVersion`, so overlapping runs cannot double-apply.
- **Result corrections** — provider corrections bump the version; commissioner results lock against later provider observations; league-scoped overrides win over everything and are audited.
- **Kickoff changes / reschedules** — `kickoffAt` updates are result observations too; postponed games keep picks pending.
- **Pick changes right at kickoff** — validated against the server clock at write time; a version-conditional write turns a race into a clean 409.
- **Players without headshots / failed loads** — default avatar with meaningful alt text.
- **Invalid / oversized images** — rejected in the browser, by the S3 policy, and by the API on finalize (object deleted).
- **Backend unavailable** — `DataError` with status 0 renders a specific "league server unreachable" state; nothing is pretended saved.
- **Refresh on a nested route / repository subpath** — hash routing + base-aware assets + `404.html` shim; verified by Playwright against a Pages-like server.
