import { useMemo } from 'react'
import { Link } from 'react-router'
import { useLeagueContext, useLeagueTimeZone } from '@/app/hooks'
import { useServices, useSession } from '@/app/hooks'
import { getTeam, getTeamOptions, type TeamOption } from '@/domain'
import { Headshot } from '@/components/Headshot'
import { LivesMeter } from '@/components/LivesMeter'
import { OutcomePill } from '@/components/OutcomePill'
import { StatusBadge } from '@/components/StatusBadge'
import { TeamMonogram } from '@/components/TeamMonogram'
import { formatKickoff } from '@/lib/time'
import { cn } from '@/lib/cn'

export function MySeason() {
  const tz = useLeagueTimeZone()
  const session = useSession()
  const { snapshot, evaluation, profileOf } = useLeagueContext()
  const { clock } = useServices()
  const playerId = session!.actor.playerId
  const me = evaluation.standings.find((s) => s.playerId === playerId)
  const profile = profileOf(playerId)
  const week = evaluation.currentWeek
  const options = useMemo(
    () => getTeamOptions(snapshot, evaluation, playerId, week, clock.now()),
    [snapshot, evaluation, playerId, week, clock],
  )

  if (!me) return <p className="text-ink-300">You are not in this season.</p>

  const available = options.filter((o) => o.state === 'available' || o.state === 'selected')
  const used = options
    .filter((o) => o.state === 'used')
    .sort((a, b) => (a.usedWeek ?? 0) - (b.usedWeek ?? 0))
  const unavailable = options.filter(
    (o) =>
      o.state === 'bye' ||
      o.state === 'locked' ||
      o.state === 'cancelled' ||
      o.state === 'postponed',
  )
  const history = me.history.filter((h) => h.week < week || h.pick || h.outcome === 'missing')
  const contenders = available.filter((o) =>
    ['KC', 'BUF', 'PHI', 'BAL', 'DET', 'SF', 'GB', 'DAL'].includes(o.team.id),
  )

  return (
    <div className="space-y-8">
      <header
        className={cn(
          'card flex items-center gap-5 p-5',
          me.status === 'eliminated' && 'graveyard',
        )}
      >
        <Headshot
          name={profile.displayName}
          playerId={profile.playerId}
          size="lg"
          status={me.status}
          bubble={me.livesRemaining === 1}
        />
        <div className="flex-1">
          <p className="eyebrow">My season</p>
          <h1 className="text-3xl font-extrabold text-ink-50 md:text-4xl">{profile.displayName}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <StatusBadge standing={me} />
            <LivesMeter total={me.livesTotal} remaining={me.livesRemaining} />
            <span className="text-sm text-ink-300">
              {me.teamsRemaining.length} teams still in the tank
            </span>
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Season stats">
        <Stat label="Weeks survived" value={me.weeksSurvived} />
        <Stat label="Wins" value={me.wins} />
        <Stat label="Teams used" value={me.teamsUsed.length} />
      </section>

      {me.status === 'alive' && contenders.length > 0 && (
        <p className="text-sm text-ink-300">
          Strategy check: you’re still holding {contenders.length} of the usual heavy favourites (
          {contenders.map((c) => c.team.abbreviation).join(', ')}). Spend them when the matchup is
          right, not when you’re nervous.
        </p>
      )}

      <TeamBucket
        title="Available this week"
        options={available}
        note={me.status === 'alive' ? 'Tap through to make your pick.' : undefined}
        link={me.status === 'alive' ? '/pick' : undefined}
      />
      <TeamBucket title="Already used" options={used} note="Gone for the season." />
      <TeamBucket
        title="Unavailable this week"
        options={unavailable}
        note="On bye, already kicked off, or postponed."
      />

      <section aria-labelledby="hist-title">
        <h2 id="hist-title" className="mb-3 text-2xl text-ink-50">
          Pick history
        </h2>
        {history.length === 0 ? (
          <p className="text-ink-300">No picks yet. Your story starts this week.</p>
        ) : (
          <ol className="card divide-y divide-white/5 p-0">
            {history.map((h) => (
              <li key={h.week} className="flex items-center gap-3 p-3 text-sm">
                <span className="w-14 font-display text-ink-300">Wk {h.week}</span>
                {h.pick ? (
                  <>
                    <TeamMonogram teamId={h.pick.teamId} size="sm" muted={h.outcome === 'void'} />
                    <span className="flex-1 font-display text-lg font-bold uppercase text-ink-50">
                      {getTeam(h.pick.teamId)?.fullName}
                    </span>
                    {h.game && (
                      <span className="hidden text-ink-400 sm:inline">
                        {h.game.homeTeamId === h.pick.teamId ? 'vs' : 'at'}{' '}
                        {
                          getTeam(
                            h.game.homeTeamId === h.pick.teamId
                              ? h.game.awayTeamId
                              : h.game.homeTeamId,
                          )?.abbreviation
                        }
                        {h.game.status === 'final'
                          ? ` · ${h.game.awayScore}-${h.game.homeScore}`
                          : ` · ${formatKickoff(h.game.kickoffAt, { timeZone: tz })}`}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="flex-1 italic text-ink-400">No pick</span>
                )}
                <OutcomePill outcome={h.outcome} />
                {h.eliminatedHere && (
                  <span className="text-flag-400" aria-label="Eliminated this week">
                    ☠
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <p className="eyebrow">{label}</p>
      <p className="font-display text-4xl font-extrabold text-ink-50">{value}</p>
    </div>
  )
}

function TeamBucket({
  title,
  options,
  note,
  link,
}: {
  title: string
  options: TeamOption[]
  note?: string
  link?: string
}) {
  const tz = useLeagueTimeZone()
  return (
    <section aria-labelledby={`bucket-${title}`}>
      <div className="mb-2 flex items-baseline gap-3">
        <h2 id={`bucket-${title}`} className="text-2xl text-ink-50">
          {title} <span className="text-ink-400">({options.length})</span>
        </h2>
        {note && <span className="text-xs text-ink-400">{note}</span>}
        {link && (
          <Link
            to={link}
            className="ml-auto font-display text-sm font-bold uppercase text-sky-400 hover:underline"
          >
            Make a pick →
          </Link>
        )}
      </div>
      {options.length === 0 ? (
        <p className="text-sm text-ink-400">None.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {options.map((o) => (
            <li
              key={o.team.id}
              className={cn(
                'flex items-center gap-2 rounded-xl border border-white/10 bg-pitch-800 py-1 pr-3 pl-1',
                o.state === 'used' && 'opacity-60',
                o.state === 'selected' && 'border-turf-500',
              )}
              title={
                o.usedWeek
                  ? `Used week ${o.usedWeek}`
                  : o.kickoffAt
                    ? formatKickoff(o.kickoffAt, { timeZone: tz })
                    : 'Bye'
              }
            >
              <TeamMonogram
                teamId={o.team.id}
                size="sm"
                muted={o.state === 'used' || o.state === 'bye'}
              />
              <span className="font-display text-sm font-bold uppercase">
                {o.team.abbreviation}
              </span>
              {o.usedWeek && <span className="text-xs text-ink-400">wk {o.usedWeek}</span>}
              {o.state === 'selected' && <span className="text-xs text-turf-400">this week</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
