# NFL schedule & results

## Abstraction

The frontend talks to `NFLDataProvider` (`src/data/interfaces.ts`):

```ts
getSchedule(seasonYear, week)   getGame(gameId)   getFinalResults(seasonYear, week)
getWeeks(seasonYear)            getTeams()        recordManualResult?()   syncResults?()   putSchedule?()
```

- **Demo/static**: `createDemoNFLProvider` serves the seeded fixture, whose schedule is the REAL one (cached by `npm run schedule:fetch`), and calls ESPN directly for live scores via `src/data/nfl/espnClient.ts`. The endpoint answers with `access-control-allow-origin: *`, so this works on GitHub Pages with no backend.
- **Connected**: `createApiNFLProvider` calls `/nfl/*` on the API. External providers are implemented **server-side only** (`backend/src/providers/`), so keys never reach the bundle.

## Server-side providers (`ExternalNFLProvider`)

| `NFL_PROVIDER` | Module | Notes |
|----------------|--------|-------|
| `manual` (default) | `backend/src/providers/index.ts` | No polling. Commissioner enters schedules (`PUT /nfl/{year}/weeks/{week}/games`, Results tab → *Enter schedule manually*) and results (*Enter result*). |
| `espn` | `backend/src/providers/espn.ts` | Unofficial public scoreboard JSON (`site.api.espn.com`), no key. Best-effort: it may change without notice. Parser is pure and unit-tested; unknown teams are skipped, never guessed. |

Adding a licensed provider: implement `fetchWeek(seasonYear, week)` returning `NFLGame[]` with ids from `gameIdFor(...)`, read the key from SSM Parameter Store inside the Lambda (`NFL_PROVIDER_SECRET_PARAM`), and register it in `resolveProvider`. Never expose it through `VITE_*`.

## Sync

`backend/src/sync.ts` is invoked by EventBridge Scheduler (`SyncScheduleExpression`, default every 15 minutes) and on demand by the commissioner (`POST /nfl/{year}/weeks/{week}/sync`). It:

1. fetches the week from the provider (new games are created as `scheduled`);
2. turns the observation into `GameResultUpdate`s and applies them with the domain's idempotent `applyGameResults`;
3. writes each changed game conditionally on `resultVersion` — overlapping runs and retries cannot double-apply;
4. never overwrites a commissioner-sourced result.

The scheduled job syncs the current week and the previous week (late corrections) of every active season, reporting per-week errors instead of failing the run.

## When the provider is down

Nothing stops. The Results tab keeps working: enter the schedule (one line per game `AWAY,HOME,KICKOFF`), enter results, correct results. The API returns `503 PROVIDER_UNAVAILABLE` with that guidance on manual sync. Weeks with no schedule data never strike anyone.
