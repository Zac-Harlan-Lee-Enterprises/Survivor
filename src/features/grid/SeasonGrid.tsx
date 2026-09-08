import { Link } from 'react-router'
import { useLeagueContext } from '@/app/hooks'
import { getTeam, type PickOutcome, type PlayerStanding } from '@/domain'
import { Headshot } from '@/components/Headshot'
import { OutcomePill } from '@/components/OutcomePill'
import { TeamMonogram } from '@/components/TeamMonogram'
import { outcomeLabel } from '@/lib/copy'
import { cn } from '@/lib/cn'

const CELL: Record<PickOutcome, string> = {
  win: 'bg-turf-500/20 text-turf-400 border-turf-500/30',
  loss: 'bg-flag-500/25 text-flag-400 border-flag-500/40',
  tie: 'bg-gold-400/20 text-gold-300 border-gold-400/40',
  missing: 'bg-flag-500/15 text-flag-400 border-flag-500/40 border-dashed',
  pending: 'bg-white/5 text-ink-100 border-white/10',
  void: 'bg-white/5 text-ink-400 border-white/10 line-through',
  not_required: 'bg-transparent text-ink-500 border-transparent',
}

/**
 * The spreadsheet, reborn: rows are players, columns are weeks, cells are the
 * picked team coloured by outcome. Desktop gets the full grid with a sticky
 * player column; phones get one expandable card per player.
 */
export function SeasonGrid() {
  const { evaluation, snapshot, profileOf } = useLeagueContext()
  const weeks = evaluation.weeks
  const hidden = new Set(snapshot.hiddenPicks.map((h) => `${h.playerId}:${h.week}`))
  const rows = evaluation.standings.filter((s) => s.status !== 'inactive')

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">{snapshot.season.label}</p>
          <h1 className="text-4xl font-extrabold text-ink-50 md:text-5xl">Season grid</h1>
        </div>
        <Legend />
      </header>

      {/* Desktop grid */}
      <div className="card hidden overflow-x-auto p-0 md:block">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">Every pick by every player, week by week</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 bg-pitch-800 px-3 py-2 text-left font-display text-xs uppercase tracking-widest text-ink-300"
              >
                Player
              </th>
              <th
                scope="col"
                className="px-2 py-2 text-center font-display text-xs uppercase tracking-widest text-ink-300"
              >
                Lives
              </th>
              {weeks.map((w) => (
                <th
                  key={w.week}
                  scope="col"
                  className={cn(
                    'px-1 py-2 text-center font-display text-xs uppercase tracking-widest text-ink-300',
                    w.isCurrent && 'text-gold-300',
                  )}
                >
                  {w.week}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const profile = profileOf(s.playerId)
              return (
                <tr
                  key={s.playerId}
                  className={cn(
                    'border-t border-white/5',
                    s.status === 'eliminated' && 'graveyard',
                  )}
                >
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-pitch-800 px-3 py-1.5 text-left font-normal"
                  >
                    <Link
                      to={`/players/${encodeURIComponent(s.playerId)}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <Headshot
                        name={profile.displayName}
                        playerId={profile.playerId}
                        size="xs"
                        status={s.status}
                      />
                      <span className="whitespace-nowrap font-display font-bold uppercase text-ink-50">
                        {profile.displayName}
                      </span>
                    </Link>
                  </th>
                  <td className="px-2 py-1.5 text-center font-display text-ink-200">
                    {s.status === 'eliminated' ? (
                      <span className="text-flag-400">OUT</span>
                    ) : (
                      `${s.livesRemaining}/${s.livesTotal}`
                    )}
                  </td>
                  {weeks.map((w) => {
                    const h = s.history.find((x) => x.week === w.week)
                    return (
                      <td key={w.week} className="px-0.5 py-1 text-center">
                        <Cell
                          standing={s}
                          outcome={h?.outcome ?? 'not_required'}
                          teamId={h?.pick?.teamId ?? null}
                          hidden={hidden.has(`${s.playerId}:${w.week}`)}
                          eliminatedHere={h?.eliminatedHere ?? false}
                          upcoming={w.week > evaluation.currentWeek}
                        />
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile alternative */}
      <div className="space-y-3 md:hidden">
        {rows.map((s) => {
          const profile = profileOf(s.playerId)
          return (
            <details
              key={s.playerId}
              className={cn('card p-3', s.status === 'eliminated' && 'graveyard')}
            >
              <summary className="flex cursor-pointer items-center gap-3 font-display text-lg font-bold uppercase text-ink-50">
                <Headshot
                  name={profile.displayName}
                  playerId={profile.playerId}
                  size="sm"
                  status={s.status}
                />
                <span className="flex-1">{profile.displayName}</span>
                <span className="text-sm text-ink-300">
                  {s.status === 'eliminated'
                    ? `Out wk ${s.eliminatedWeek}`
                    : `${s.livesRemaining}/${s.livesTotal}`}
                </span>
              </summary>
              <ol className="mt-3 grid grid-cols-3 gap-2 text-sm">
                {s.history
                  .filter((h) => h.outcome !== 'not_required' || h.week <= evaluation.currentWeek)
                  .map((h) => (
                    <li
                      key={h.week}
                      className="flex flex-col items-center gap-1 rounded-lg border border-white/5 p-2"
                    >
                      <span className="text-[11px] uppercase tracking-wider text-ink-400">
                        Wk {h.week}
                      </span>
                      <Cell
                        standing={s}
                        outcome={h.outcome}
                        teamId={h.pick?.teamId ?? null}
                        hidden={hidden.has(`${s.playerId}:${h.week}`)}
                        eliminatedHere={h.eliminatedHere}
                        upcoming={h.week > evaluation.currentWeek}
                      />
                    </li>
                  ))}
              </ol>
            </details>
          )
        })}
      </div>
    </div>
  )
}

function Cell({
  outcome,
  teamId,
  hidden,
  eliminatedHere,
  upcoming,
}: {
  standing: PlayerStanding
  outcome: PickOutcome
  teamId: string | null
  hidden: boolean
  eliminatedHere: boolean
  upcoming: boolean
}) {
  if (upcoming && !teamId)
    return (
      <span className="text-ink-500" role="img" aria-label="Upcoming">
        ·
      </span>
    )
  if (hidden)
    return (
      <span
        className="inline-block min-w-11 rounded-md border border-white/10 bg-white/5 px-1 py-1 text-xs text-ink-300"
        role="img"
        aria-label="Pick locked in, hidden until kickoff"
        title="Pick locked in, hidden until kickoff"
      >
        🔒
      </span>
    )
  if (!teamId && outcome === 'not_required')
    return (
      <span className="text-ink-500" role="img" aria-label="Not required">
        ·
      </span>
    )
  if (!teamId && outcome === 'pending')
    return (
      <span
        className="inline-block min-w-11 rounded-md border border-dashed border-white/15 px-1 py-1 text-xs text-ink-400"
        role="img"
        aria-label="No pick yet"
      >
        —
      </span>
    )
  if (!teamId)
    return (
      <span
        className={cn(
          'inline-block min-w-11 rounded-md border px-1 py-1 font-display text-xs font-bold uppercase',
          CELL[outcome],
        )}
      >
        {outcomeLabel(outcome)}
      </span>
    )
  const team = getTeam(teamId)
  return (
    <span
      role="img"
      className={cn(
        'inline-flex min-w-11 items-center justify-center gap-1 rounded-md border px-1 py-1 font-display text-xs font-bold uppercase',
        CELL[outcome],
        eliminatedHere && 'ring-2 ring-flag-500',
      )}
      title={`${team?.fullName ?? teamId}: ${outcomeLabel(outcome)}${eliminatedHere ? ' — eliminated' : ''}`}
      aria-label={`${team?.fullName ?? teamId}: ${outcomeLabel(outcome)}${eliminatedHere ? ', eliminated' : ''}`}
    >
      <TeamMonogram teamId={teamId} size="xs" muted={outcome === 'void'} />
      {eliminatedHere && <span aria-hidden="true">☠</span>}
    </span>
  )
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-2 text-xs" aria-label="Legend">
      {(['win', 'loss', 'tie', 'pending', 'missing', 'void'] as PickOutcome[]).map((o) => (
        <li key={o}>
          <OutcomePill outcome={o} />
        </li>
      ))}
      <li className="inline-flex items-center gap-1 rounded-md border border-white/10 px-1.5 py-0.5 text-ink-300">
        🔒 hidden until kickoff
      </li>
      <li className="inline-flex items-center gap-1 rounded-md border border-flag-500 px-1.5 py-0.5 text-flag-400">
        ☠ eliminated
      </li>
    </ul>
  )
}
