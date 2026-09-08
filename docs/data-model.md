# Data model

Schemas are zod objects in `src/domain/models.ts` and are used by the browser (fixtures, API responses), the API (request bodies, stored rows) and the seed script.

| Entity | Notes |
|--------|-------|
| `League` | `settings: LeagueSettings` (lives, tie/missing/cancelled policies, simultaneous-elimination policy, pick hiding, display TZ), `currentSeasonId`. |
| `Season` | `year`, `startWeek`, `endWeek`, `status`, `isSynthetic` (demo). |
| `Player` / `PlayerProfile` | profile is the public shape (name, nickname, tagline, `imageId`); email is stored only in DynamoDB. |
| `PlayerImage` | key-only variants, content type, size, dimensions. |
| `LeagueMembership` | role (`commissioner` / `player`), status (`active` / `inactive`), optional `livesOverride`. |
| `NFLTeam` | 32 teams, abbreviations, colours, aliases (`src/domain/teams.ts`). |
| `NFLWeek` | bye team ids per week. |
| `NFLGame` | `kickoffAt` (UTC), status, scores, `winnerTeamId` (`null` = tie), `resultVersion`, `resultSource`. |
| `Pick` | one per player per week, `gameId`, `version` (optimistic concurrency), `source` (`player` / `commissioner` / `import`). |
| `PickOutcome` | derived: `win · loss · tie · pending · void · missing · not_required`. |
| `LeagueGameOverride` | commissioner correction of a game's result, league-scoped, wins over provider data. |
| `SeasonDecision` | recorded champion(s) for tiebreakers/disputes. |
| `CommissionerOverride` | before/after + reason for every commissioner change. |
| `AuditEvent` | append-only log of everything. |
| `SeasonSnapshot` | the aggregate the engine consumes; `hiddenPicks` stubs replace redacted picks. |

Timestamps are ISO-8601 UTC; rendering uses the viewer's timezone (`src/lib/time.ts`).

## Derived, never stored

Strikes, lives remaining, eliminated status/week, teams used/remaining, standings order, champions — all produced by `evaluateSeason`.

## DynamoDB single table (`backend/src/lib/keys.ts`)

| PK | SK | Entity |
|----|----|--------|
| `LEAGUES` | `LEAGUE#<leagueId>` | league index |
| `SEASONS` | `SEASON#<seasonId>` | season → league index |
| `LEAGUE#<id>` | `META` | League |
| `LEAGUE#<id>` | `SEASON#<seasonId>` | Season |
| `LEAGUE#<id>` | `MEMBER#<seasonId>#<playerId>` | LeagueMembership |
| `LEAGUE#<id>` | `GAMEOVERRIDE#<gameId>` | LeagueGameOverride |
| `LEAGUE#<id>` | `OVERRIDE#<isoTs>#<id>` | CommissionerOverride |
| `LEAGUE#<id>` | `AUDIT#<isoTs>#<id>` | AuditEvent |
| `SEASON#<seasonId>` | `PICK#<playerId>#<ww>` | Pick |
| `SEASON#<seasonId>` | `DECISION` | SeasonDecision |
| `PLAYER#<playerId>` | `PROFILE` | PlayerProfile (+ email) |
| `PLAYER#<playerId>` | `IMAGE#<imageId>` | PlayerImage |
| `USER#<cognitoSub>` | `PLAYER` | identity → player link |
| `NFL#<year>` | `WEEK#<ww>` | NFLWeek |
| `NFL#<year>` | `GAME#<ww>#<gameId>` | NFLGame |

Conditional writes: picks (`attribute_not_exists` / `version = :expected`), games (`resultVersion = :expected`).
