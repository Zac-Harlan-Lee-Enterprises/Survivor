import { useMemo, useState } from 'react'
import { useLeagueContext } from '@/app/hooks'
import { useServices } from '@/app/hooks'
import { useInvalidateSeason } from '@/app/queries'
import { importGridCsv, materializePicks, renderReportMarkdown, type ImportResult } from '@/domain'
import { Button } from '@/components/ui/button'
import { Label, Textarea } from '@/components/ui/input'
import { Notice } from '@/components/Notice'
import { errorMessage } from '@/lib/errors'

const SAMPLE = `Player,Week 1
Maya Israel,Jaguars
Shahid Ali,Ravens
Dave Johnson,Lions*
`

/**
 * Spreadsheet migration: paste or upload the CSV export of the commissioner's
 * sheet (players × weeks; "*" marks a red/losing cell). The report lists every
 * ambiguity and rule violation; nothing is committed until it is reviewed.
 */
export function ImportPanel() {
  const { snapshot, league } = useLeagueContext()
  const { picks } = useServices()
  const invalidate = useInvalidateSeason()
  const [csv, setCsv] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const nameToId = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of snapshot.profiles) {
      map.set(p.displayName.trim().toLowerCase(), p.playerId)
      if (p.nickname) map.set(p.nickname.trim().toLowerCase(), p.playerId)
    }
    return map
  }, [snapshot.profiles])

  const analyze = () => {
    setNotice(null)
    const r = importGridCsv(csv, {
      source: 'pasted CSV',
      games: snapshot.games,
      lives: league.settings.defaultLives,
    })
    setResult(r)
  }

  const materialized = useMemo(() => {
    if (!result) return null
    return materializePicks(result, {
      leagueId: league.id,
      seasonId: snapshot.season.id,
      games: snapshot.games,
      playerIdByName: (n) => nameToId.get(n.trim().toLowerCase()),
      now: new Date(),
    })
  }, [result, league.id, snapshot.season.id, snapshot.games, nameToId])

  const commit = async () => {
    if (!materialized) return
    setBusy(true)
    setNotice(null)
    try {
      const r = await picks.importPicks(
        snapshot.season.id,
        materialized.picks,
        'spreadsheet import',
      )
      invalidate()
      setNotice({
        tone: 'success',
        text: `${r.imported} picks imported. Re-run the analysis any time; imports overwrite matching player/week cells.`,
      })
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setCsv(await file.text())
  }

  const blocking = (result?.report.counts.error ?? 0) + (materialized?.issues.length ?? 0)

  return (
    <div className="space-y-5">
      <div className="card space-y-3 p-5">
        <h2 className="text-2xl text-ink-50">Import spreadsheet picks</h2>
        <p className="text-sm text-ink-300">
          Export the sheet as CSV: first column is the player, then one column per week (“Week 1”,
          “Week 2”, …). Put a <code className="rounded bg-white/10 px-1">*</code> after a team that
          lost (the red cells). Unreadable or ambiguous cells are reported, never guessed.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-ink-200">
            <span className="mr-2">Upload CSV</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => void onFile(e.target.files?.[0])}
              className="text-sm"
            />
          </label>
          <Button variant="ghost" size="sm" onClick={() => setCsv(SAMPLE)}>
            Load sample
          </Button>
        </div>
        <div>
          <Label htmlFor="csv">CSV</Label>
          <Textarea
            id="csv"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            className="min-h-40 font-mono text-xs"
            spellCheck={false}
          />
        </div>
        <Button onClick={analyze} disabled={!csv.trim()}>
          Analyze
        </Button>
      </div>

      {result && materialized && (
        <div className="card space-y-3 p-5">
          <h3 className="text-xl text-ink-50">Import report</h3>
          <p className="text-sm text-ink-300">
            {result.report.players} players · {result.report.picksParsed} picks parsed ·{' '}
            {result.report.counts.error} errors · {result.report.counts.warning} warnings ·{' '}
            {result.report.counts.info} notes
          </p>
          {materialized.issues.length > 0 && (
            <Notice tone="error">
              <ul className="list-disc pl-4">
                {materialized.issues.map((i, k) => (
                  <li key={k}>{i.message}</li>
                ))}
              </ul>
            </Notice>
          )}
          {result.report.issues.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-ink-400">
                  <tr>
                    <th className="p-2">Severity</th>
                    <th className="p-2">Code</th>
                    <th className="p-2">Player</th>
                    <th className="p-2">Week</th>
                    <th className="p-2">Cell</th>
                    <th className="p-2">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {result.report.issues.map((i, k) => (
                    <tr key={k} className="border-t border-white/5">
                      <td
                        className={`p-2 font-display uppercase ${i.severity === 'error' ? 'text-flag-400' : i.severity === 'warning' ? 'text-gold-300' : 'text-sky-400'}`}
                      >
                        {i.severity}
                      </td>
                      <td className="p-2 font-mono text-xs">{i.code}</td>
                      <td className="p-2">{i.player ?? ''}</td>
                      <td className="p-2">{i.week ?? ''}</td>
                      <td className="p-2 font-mono text-xs">{i.raw ?? ''}</td>
                      <td className="p-2 text-ink-200">{i.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-turf-400">
              Clean import: every cell resolved and no rules were violated.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => void commit()}
              disabled={busy || blocking > 0 || materialized.picks.length === 0}
            >
              {busy ? 'Importing…' : `Import ${materialized.picks.length} picks`}
            </Button>
            {blocking > 0 && (
              <span className="text-sm text-ink-300">
                Fix the {blocking} blocking issue{blocking === 1 ? '' : 's'} in the CSV, then
                analyze again.
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                void navigator.clipboard?.writeText(renderReportMarkdown(result.report))
              }
            >
              Copy report (Markdown)
            </Button>
          </div>
        </div>
      )}
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
    </div>
  )
}
