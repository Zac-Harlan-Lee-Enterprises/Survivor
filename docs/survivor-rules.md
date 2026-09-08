# Survivor rules — as implemented

All rules live in `src/domain/rules/` and are covered by `src/domain/rules/*.test.ts`. League settings (`LeagueSettings`) make the configurable parts explicit; defaults match the league's spec.

## Core

- Each active player picks **one team to win** each week.
- **Win** → no life lost. **Loss or tie** → one life lost (`tieCountsAsMiss`, default on).
- Players start with `defaultLives` (3); a commissioner may set a per-player `livesOverride`.
- The **third miss eliminates** the player in that week. Later weeks are `not_required` and can never add strikes.
- A team **cannot be reused** once it has been *consumed*: its game kicked off or resolved (win/loss/tie). A pick that is still changeable does not consume the team yet; a voided pick returns the team.
- Different players may pick the same team.

## Weeks, deadlines, missing picks

- A week's **deadline is the kickoff of its last non-cancelled game**. Picks for the current week are allowed for any team whose own game has not kicked off.
- Only the **current week** (first week that is not final) accepts picks.
- No pick while the week is open → `pending`. No pick once the deadline passed → `missing` → one life (`missingPickCountsAsMiss`).
- A week with **no schedule data** (provider outage) is `not_required`: nobody is struck by a data problem.
- A week whose games are **all cancelled** requires nothing.

## Game situations

| Game status | Pick outcome |
|-------------|--------------|
| `final`, picked team won | `win` |
| `final`, picked team lost | `loss` |
| `final`, tie | `tie` (life lost by default) |
| `scheduled` / `in_progress` | `pending` |
| `postponed` | `pending`; the week is not settled until it resolves |
| `cancelled` | `void` (no life, team returned) — or `missing` when `cancelledGamePolicy = 'miss'` |

Kickoff changes are result observations; a rescheduled game keeps its id (`<year>-w<ww>-<away>-at-<home>`).

## Champions

- When a settled week leaves **exactly one** player alive (out of ≥ 2 participants), they are **champion**; later weeks are `not_required`.
- When a settled week eliminates **everyone** who entered it alive, those players are **finalists**: co-champions by default, or "tied finalists" awaiting a recorded commissioner decision (`simultaneousEliminationPolicy = 'commissioner-decides'`).
- When the **final week settles with ≥ 2 alive**, the same policy applies.
- A recorded `SeasonDecision` always wins (tiebreakers, disputes) and is audited.
- No champion is crowned while the deciding week still has pending games.

## Visibility

- Your own pick is always visible to you; the commissioner sees everything.
- Other players' picks are hidden until their game kicks off (`hidePicksUntilLocked`). The UI shows "Locked in 🔒" instead of the team. Enforced in the demo adapter and on the API (`redactSnapshot`).

## Results processing

- Observations (provider or commissioner) pass through `applyGameResult`: identical observations are no-ops, any accepted change bumps `resultVersion` once, a commissioner-sourced result locks the game against provider updates until explicitly released.
- Commissioner **league overrides** (`LeagueGameOverride`) sit on top of the stored game and win.
- Everything re-evaluates from picks + results, so a correction never leaves stale strikes behind.

## Determinism

`evaluateSeason` has no clock or randomness of its own: `now` is an argument. The same snapshot + `now` always produces the same evaluation (tested).
