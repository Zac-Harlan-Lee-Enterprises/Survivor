# Spreadsheet import report

## Status of the attached screenshot

**The spreadsheet screenshot referenced in the brief did not reach this session** — no image was attached and none was found in the project directory (the only image nearby was unrelated and was not used). Per the brief's own instruction not to guess unreadable data, **no real league data was seeded**. The demo league uses clearly fictional sample players and a synthetic schedule.

What exists instead, ready for the real data:

1. `data/import/sample-league.csv` — the expected CSV shape (players × weeks, `*` marks a losing/red cell).
2. `npm run import:report -- <sheet.csv> --out report.md` — validates against the season's schedule and rules and writes the report.
3. Commissioner → **Import** tab — paste/upload the CSV, review the report, commit picks (blocked while errors remain).

Registry entry `import-real-league-from-screenshot` stays `passes: false` until **data/import/league.csv** exists (gitignored by default because it holds real names).

## What the report flags

| Code | Severity | Meaning |
|------|----------|---------|
| `AMBIGUOUS_TEAM` | error | e.g. "Los Angeles" (LAC or LAR), "New York" (NYG or NYJ) — choose one. |
| `UNKNOWN_TEAM` | error | cell text is not a recognisable team. |
| `REUSED_TEAM` | error | same team in two weeks for one player. |
| `DUPLICATE_PLAYER`, `EMPTY_PLAYER_NAME`, `HEADER_MISSING`, `WEEK_COLUMN_UNRECOGNISED` | error/warning | structural problems. |
| `TEAM_ON_BYE` | error | team did not play that week (needs the schedule). |
| `MISSING_PICK` | warning | empty cell before the player's latest pick — counted as a miss. |
| `PICK_AFTER_ELIMINATION` | warning | picks recorded after a third miss. |
| `LOSS_MARKER_CONTRADICTS_RESULT` | warning | the sheet's red cell disagrees with the known result. |
| `RECORDED_LOSS` | info | red cell preserved where no result is available to verify. |
| `UNKNOWN_PLAYER` | error | (at commit) no league member matches the row name. |

## Sample run

`data/import/sample-report.md` is the report for the sample CSV against the demo schedule (one warning: a deliberately blank week-2 cell).
