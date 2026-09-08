/**
 * import-report — CLI for the spreadsheet migration workflow.
 *
 *   npm run import:report -- data/import/sample-league.csv [--out data/import/report.md]
 *
 * Reads a players × weeks CSV (the commissioner's sheet), validates every cell
 * against the demo season's schedule (bye weeks, results) and the survivor
 * rules, and writes a Markdown report listing ambiguous cells, invalid teams,
 * reused teams, missing picks and other violations. Nothing is guessed.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { importGridCsv, renderReportMarkdown } from '../src/domain/import/importGrid'
import { SeasonSnapshotSchema } from '../src/domain/models'

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--'))
if (!file) {
  console.error('usage: npm run import:report -- <sheet.csv> [--out report.md] [--no-schedule]')
  process.exit(2)
}
const outIdx = args.indexOf('--out')
const out = outIdx >= 0 ? args[outIdx + 1] : undefined
const useSchedule = !args.includes('--no-schedule')

const csv = readFileSync(resolve(process.cwd(), file), 'utf8')
const snapshot = SeasonSnapshotSchema.parse(
  JSON.parse(
    readFileSync(resolve(process.cwd(), 'src/data/demo/fixtures/demo-season.json'), 'utf8'),
  ),
)
const result = importGridCsv(csv, {
  source: file,
  games: useSchedule ? snapshot.games : undefined,
  lives: snapshot.league.settings.defaultLives,
  now: new Date(),
})
const md = renderReportMarkdown(result.report)
if (out) {
  writeFileSync(resolve(process.cwd(), out), md)
  console.log(
    `wrote ${out}: ${result.report.players} players, ${result.report.picksParsed} picks, ${result.report.counts.error} errors, ${result.report.counts.warning} warnings`,
  )
} else {
  process.stdout.write(md)
}
process.exit(result.report.counts.error > 0 ? 1 : 0)
