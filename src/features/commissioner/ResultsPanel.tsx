import { useState, type FormEvent } from 'react'
import { RefreshCw } from 'lucide-react'
import { useLeagueContext, useLeagueTimeZone } from '@/app/hooks'
import { useServices } from '@/app/hooks'
import { useInvalidateSeason } from '@/app/queries'
import { useLiveScores } from '@/app/useLiveScores'
import { applyGameOverrides, getTeam, lookupTeam, type NFLGame } from '@/domain'
import { TeamMonogram } from '@/components/TeamMonogram'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input, Label, Select, Textarea } from '@/components/ui/input'
import { Notice } from '@/components/Notice'
import { errorMessage } from '@/lib/errors'
import { formatKickoff } from '@/lib/time'

/**
 * Results per week. The provider (or the synthetic demo feed) fills these in;
 * the commissioner can correct any game, enter a result manually when the
 * provider is down, or clear a correction. Corrections are league-scoped
 * overrides and win over later provider updates.
 */
/** Raw enum values were being printed at people ("in_progress"). */
const STATUS_LABEL: Record<NFLGame['status'], string> = {
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  final: 'Final',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
}

export function ResultsPanel() {
  const tz = useLeagueTimeZone()
  const { snapshot, evaluation } = useLeagueContext()
  const { nfl } = useServices()
  const invalidate = useInvalidateSeason()
  const [week, setWeek] = useState(evaluation.currentWeek)
  const [target, setTarget] = useState<NFLGame | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [syncing, setSyncing] = useState(false)
  const games = applyGameOverrides(snapshot.games, snapshot.gameOverrides)
    .filter((g) => g.week === week)
    .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))
  const overridden = new Set(snapshot.gameOverrides.map((o) => o.gameId))
  const weekSource =
    snapshot.weeks.find((w) => w.seasonYear === snapshot.season.year && w.week === week)?.source ??
    'synthetic'

  const sync = async () => {
    if (!nfl.syncResults) return
    setSyncing(true)
    setNotice(null)
    try {
      const r = await nfl.syncResults(snapshot.season.year, week)
      invalidate()
      const parts = [`${r.changed} updated`, `${r.skipped} unchanged`]
      if (r.created) parts.push(`${r.created} games added`)
      if (r.relinkedPicks) parts.push(`${r.relinkedPicks} picks re-linked to the real fixtures`)
      const orphans = r.orphanedPicks.length
        ? ` Check these picks — their team is not on ${r.provider}'s slate for week ${week}: ${r.orphanedPicks.join(', ')}.`
        : ''
      setNotice({
        tone: orphans ? 'error' : 'success',
        text: `${r.provider}: ${parts.join(', ')}.${orphans}`,
      })
    } catch (err) {
      setNotice({
        tone: 'error',
        text: `Provider unavailable: ${errorMessage(err)} Enter results manually below — the league keeps running.`,
      })
    } finally {
      setSyncing(false)
    }
  }

  // Live refresh is shared with the league page (useLiveScores), so this panel
  // no longer runs an interval of its own. Its old condition waited for a game
  // to be in_progress, which only a sync could ever make true.
  const { detail: liveDetail } = useLiveScores(snapshot.season.year, week, games)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="rs-week" className="mb-0">
          Week
        </Label>
        <Select
          id="rs-week"
          value={week}
          onChange={(e) => setWeek(Number(e.target.value))}
          className="w-32"
        >
          {evaluation.weeks.map((w) => (
            <option key={w.week} value={w.week}>
              Week {w.week}
            </option>
          ))}
        </Select>
        <span className="text-sm text-ink-400">
          {weekSource === 'provider'
            ? 'Schedule and scores are live from ESPN.'
            : weekSource === 'manual'
              ? 'Schedule entered by hand.'
              : 'Placeholder schedule — sync to load the real fixtures and live scores.'}
        </span>
        {nfl.syncResults && (
          <Button variant="secondary" size="sm" onClick={() => void sync()} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} aria-hidden="true" />{' '}
            {weekSource === 'provider' ? 'Refresh live scores' : 'Load real schedule & scores'}
          </Button>
        )}
      </div>
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      {games.length === 0 ? (
        <p className="text-ink-300">
          No games loaded for week {week}. If the provider is down, results can still be recorded
          once the schedule is entered.
        </p>
      ) : (
        <ul className="card divide-y divide-white/5 p-0">
          {games.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <span className="flex items-center gap-2 font-display text-base font-bold uppercase">
                <TeamMonogram teamId={g.awayTeamId} size="xs" /> {g.awayTeamId}{' '}
                <span className="text-ink-400">at</span>{' '}
                <TeamMonogram teamId={g.homeTeamId} size="xs" /> {g.homeTeamId}
              </span>
              <span className="text-ink-400">{formatKickoff(g.kickoffAt, { timeZone: tz })}</span>
              <span className="ml-auto font-display tabular-nums">
                {g.status === 'final'
                  ? `${g.awayScore}–${g.homeScore} · ${g.winnerTeamId === null ? 'TIE' : `${g.winnerTeamId} win`}`
                  : g.status === 'in_progress'
                    ? `${g.awayScore ?? 0}–${g.homeScore ?? 0} · ${liveDetail[g.id] ?? 'in progress'}`
                    : STATUS_LABEL[g.status]}
              </span>
              {overridden.has(g.id) && (
                <span className="rounded-full bg-gold-400/20 px-2 py-0.5 text-xs text-gold-300">
                  corrected
                </span>
              )}
              <Button variant="secondary" size="sm" onClick={() => setTarget(g)}>
                {g.status === 'final' ? 'Correct' : 'Enter result'}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        {target && (
          <ResultDialog
            game={target}
            overridden={overridden.has(target.id)}
            onDone={() => setTarget(null)}
          />
        )}
      </Dialog>
      {nfl.putSchedule && (
        <ScheduleEntry year={snapshot.season.year} week={week} existing={games} />
      )}
    </div>
  )
}

/**
 * Manual schedule entry — the fallback when no provider is configured or the
 * provider is down. One game per line: AWAY,HOME,KICKOFF (ISO-8601, with zone).
 */
function ScheduleEntry({
  year,
  week,
  existing,
}: {
  year: number
  week: number
  existing: NFLGame[]
}) {
  const { nfl } = useServices()
  const invalidate = useInvalidateSeason()
  const [text, setText] = useState('')
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const parse = (): NFLGame[] => {
    const now = new Date().toISOString()
    return text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((line, i) => {
        const [awayRaw, homeRaw, kick] = line.split(',').map((x) => x?.trim() ?? '')
        const away = lookupTeam(awayRaw ?? '')
        const home = lookupTeam(homeRaw ?? '')
        if (away.kind !== 'match' || home.kind !== 'match')
          throw new Error(`Line ${i + 1}: unknown or ambiguous team ("${awayRaw}", "${homeRaw}").`)
        const kickoff = new Date(kick ?? '')
        if (Number.isNaN(kickoff.getTime()))
          throw new Error(
            `Line ${i + 1}: kickoff "${kick}" is not a valid date/time (use ISO-8601, e.g. 2026-09-13T17:00:00Z).`,
          )
        const prev = existing.find(
          (g) => g.homeTeamId === home.teamId && g.awayTeamId === away.teamId,
        )
        return {
          id: `${year}-w${String(week).padStart(2, '0')}-${away.teamId}-at-${home.teamId}`,
          seasonYear: year,
          week,
          homeTeamId: home.teamId,
          awayTeamId: away.teamId,
          kickoffAt: kickoff.toISOString(),
          status: prev?.status ?? 'scheduled',
          homeScore: prev?.homeScore,
          awayScore: prev?.awayScore,
          winnerTeamId: prev?.winnerTeamId,
          resultVersion: prev?.resultVersion ?? 0,
          resultSource: prev?.resultSource,
          updatedAt: now,
        }
      })
  }

  const save = async () => {
    setBusy(true)
    setNotice(null)
    try {
      const games = parse()
      if (games.length === 0) throw new Error('Nothing to save.')
      const r = await nfl.putSchedule!(year, week, games)
      invalidate()
      setNotice({
        tone: 'success',
        text: `${r.saved} games saved for week ${week}. Existing results were kept.`,
      })
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <details className="card p-4">
      <summary className="cursor-pointer font-display text-lg font-bold uppercase text-ink-50">
        Enter week {week} schedule manually
      </summary>
      <p className="mt-2 text-sm text-ink-300">
        Provider down, or no provider configured? Paste one game per line as{' '}
        <code className="rounded bg-white/10 px-1">AWAY,HOME,KICKOFF</code> (ISO-8601 with
        timezone). Replaces the week's schedule; results already recorded are preserved by matchup.
      </p>
      <div className="mt-3">
        <Label htmlFor={`sched-${week}`}>Games</Label>
        <Textarea
          id={`sched-${week}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`CHI,GB,2026-09-13T17:00:00Z\nKC,DEN,2026-09-13T20:25:00Z`}
          className="min-h-32 font-mono text-xs"
          spellCheck={false}
        />
      </div>
      <Button
        className="mt-3"
        variant="secondary"
        onClick={() => void save()}
        disabled={busy || !text.trim()}
      >
        {busy ? 'Saving…' : 'Save schedule'}
      </Button>
      {notice && (
        <Notice tone={notice.tone} className="mt-3">
          {notice.text}
        </Notice>
      )}
    </details>
  )
}

function ResultDialog({
  game,
  overridden,
  onDone,
}: {
  game: NFLGame
  overridden: boolean
  onDone: () => void
}) {
  const tz = useLeagueTimeZone()
  const { snapshot } = useLeagueContext()
  const { leagues } = useServices()
  const invalidate = useInvalidateSeason()
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<NFLGame['status']>(
    game.status === 'scheduled' ? 'final' : game.status,
  )

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const reason = String(form.get('reason') ?? '').trim()
    if (!reason) {
      setNotice({ tone: 'error', text: 'A reason is required — it goes in the audit log.' })
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      const home = form.get('homeScore')
      const away = form.get('awayScore')
      await leagues.overrideGameResult({
        leagueId: snapshot.league.id,
        gameId: game.id,
        status,
        homeScore: status === 'final' && home !== '' ? Number(home) : undefined,
        awayScore: status === 'final' && away !== '' ? Number(away) : undefined,
        winnerTeamId:
          status === 'final' ? winnerFrom(String(form.get('winner') ?? 'score'), game) : undefined,
        reason,
      })
      invalidate()
      setNotice({ tone: 'success', text: 'Result recorded. Standings recalculated.' })
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  const clear = async () => {
    setBusy(true)
    try {
      await leagues.clearGameOverride(snapshot.league.id, game.id, 'correction withdrawn')
      invalidate()
      setNotice({ tone: 'success', text: 'Correction cleared; provider result restored.' })
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <DialogContent
      title={`${getTeam(game.awayTeamId)?.name} at ${getTeam(game.homeTeamId)?.name}`}
      description={`Week ${game.week} · ${formatKickoff(game.kickoffAt, { timeZone: tz })}`}
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-3">
        <div>
          <Label htmlFor="rd-status">Status</Label>
          <Select
            id="rd-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as NFLGame['status'])}
          >
            <option value="final">Final</option>
            <option value="scheduled">Scheduled (not played yet)</option>
            <option value="postponed">Postponed</option>
            <option value="cancelled">Cancelled (picks void per league policy)</option>
          </Select>
        </div>
        {status === 'final' && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="rd-away">{game.awayTeamId} score</Label>
              <Input
                id="rd-away"
                name="awayScore"
                type="number"
                min={0}
                defaultValue={game.awayScore ?? ''}
              />
            </div>
            <div>
              <Label htmlFor="rd-home">{game.homeTeamId} score</Label>
              <Input
                id="rd-home"
                name="homeScore"
                type="number"
                min={0}
                defaultValue={game.homeScore ?? ''}
              />
            </div>
            <div>
              <Label htmlFor="rd-winner">Winner</Label>
              <Select id="rd-winner" name="winner" defaultValue="score">
                <option value="score">From score</option>
                <option value={game.homeTeamId}>{game.homeTeamId}</option>
                <option value={game.awayTeamId}>{game.awayTeamId}</option>
                <option value="tie">Tie</option>
              </Select>
            </div>
          </div>
        )}
        <div>
          <Label htmlFor="rd-reason">Reason (required, audited)</Label>
          <Input
            id="rd-reason"
            name="reason"
            placeholder="e.g. provider posted the wrong final"
            required
          />
        </div>
        {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
        <div className="flex flex-wrap justify-end gap-2">
          {overridden && (
            <Button variant="outline" onClick={() => void clear()} disabled={busy}>
              Clear correction
            </Button>
          )}
          <Button variant="ghost" onClick={onDone}>
            Close
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Record result'}
          </Button>
        </div>
      </form>
    </DialogContent>
  )
}

function winnerFrom(value: string, game: NFLGame): string | null | undefined {
  if (value === 'score') return undefined
  if (value === 'tie') return null
  return value === game.homeTeamId || value === game.awayTeamId ? value : undefined
}
