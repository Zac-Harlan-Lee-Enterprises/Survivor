#!/usr/bin/env node
/**
 * fetch-nfl-schedule — caches the REAL NFL schedule so the app ships real
 * fixtures instead of placeholders.
 *
 *   npm run schedule:fetch                # 2026 regular season, weeks 1-18
 *   npm run schedule:fetch -- --year 2027
 *
 * Writes scripts/data/nfl-<year>-schedule.json, which is COMMITTED and read by
 * generate-demo-fixtures.ts. Caching it this way keeps fixture generation
 * deterministic and offline-capable: this script is the only part that touches
 * the network, and it is run deliberately.
 *
 * Live scores during games do not come from here — the app refreshes those
 * itself (Commissioner → Results → Refresh live scores).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const args = process.argv.slice(2)
const flagOf = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const YEAR = Number(flagOf('year', '2026'))
const FIRST = Number(flagOf('from', '1'))
const LAST = Number(flagOf('to', '18'))

// Reuse the domain parser rather than re-implementing the payload shape.
const bundle = resolve(process.cwd(), 'node_modules/.tmp/espn-parser.mjs')
await build({
  entryPoints: [resolve(process.cwd(), 'src/domain/nfl/espn.ts')],
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'warning',
})
const { espnWeekUrl, parseScoreboard } = await import(`file://${bundle}`)

const observedAt = new Date().toISOString()
const weeks = []
let totalGames = 0

for (let week = FIRST; week <= LAST; week++) {
  const res = await fetch(espnWeekUrl(YEAR, week), { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    console.error(
      `week ${week}: ESPN responded ${res.status} — aborting rather than caching a partial season`,
    )
    process.exit(1)
  }
  const parsed = parseScoreboard(await res.json(), observedAt, { seasonYear: YEAR, week })
  if (parsed.games.length === 0) {
    console.error(`week ${week}: no games returned — aborting`)
    process.exit(1)
  }
  weeks.push({ week: parsed.week, games: parsed.games })
  totalGames += parsed.games.length
  const finals = parsed.games.filter((g) => g.status === 'final').length
  console.log(
    `  week ${String(week).padStart(2)}: ${parsed.games.length} games, ${parsed.week.byeTeamIds.length} on bye${finals ? `, ${finals} final` : ''}${parsed.skipped ? `, ${parsed.skipped} skipped` : ''}`,
  )
}

const out = resolve(process.cwd(), 'scripts/data', `nfl-${YEAR}-schedule.json`)
mkdirSync(resolve(process.cwd(), 'scripts/data'), { recursive: true })
writeFileSync(
  out,
  JSON.stringify(
    { seasonYear: YEAR, source: 'espn-public-scoreboard', fetchedAt: observedAt, weeks },
    null,
    2,
  ) + '\n',
)
console.log(`\nwrote ${out}: ${weeks.length} weeks, ${totalGames} games`)
console.log('Next: npm run fixtures:generate')
