# Spreadsheet import report

## Where the league data came from

The spreadsheet screenshot referenced in the original brief **never reached the session** — no image was attached. Nothing was guessed from it.

Instead the commissioner supplied the week 1 picks directly, and those are what the app is seeded with:

- `data/import/league.csv` holds them in import format (gitignored: it names real people).
- `scripts/generate-demo-fixtures.ts` seeds the same nine players and picks into the league.
- **No results are seeded.** None were supplied, so none were invented; every pick is pending and everyone holds three lives until real results are entered.
- The **schedule remains synthetic**. The real NFL fixture list is not known here, so matchups and kickoff times are placeholders and the season stays flagged `isSynthetic`.

To load more weeks, add columns to the CSV and import it again (Commissioner → Import), or run the report from the command line:

```bash
npm run import:report -- data/import/league.csv --out report.md
```

`data/import/sample-league.csv` is a format example with placeholder names, kept for documentation and covered by the `import-report-sample` registry entry.

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
