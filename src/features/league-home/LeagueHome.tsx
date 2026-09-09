import { Link } from 'react-router'
import { Crown, Flame, Skull, Zap } from 'lucide-react'
import { useLeagueContext, useLeagueTimeZone } from '@/app/hooks'
import { useSession } from '@/app/hooks'
import { getTeam, weekSummary, type NFLGame, type PlayerStanding } from '@/domain'
import { Headshot } from '@/components/Headshot'
import { PlayerCard } from '@/components/PlayerCard'
import { TeamMonogram } from '@/components/TeamMonogram'
import { Countdown } from '@/components/Countdown'
import { Button } from '@/components/ui/button'
import { useConfetti } from '@/components/useConfetti'
import { formatKickoff } from '@/lib/time'
import { cn } from '@/lib/cn'

export function LeagueHome() {
  const tz = useLeagueTimeZone()
  const { league, snapshot, evaluation, profileOf, viewer } = useLeagueContext()
  const session = useSession()
  const week = weekSummary(evaluation, evaluation.currentWeek)
  const alive = evaluation.standings.filter((s) => s.status === 'alive')
  const bubble = alive.filter((s) => s.livesRemaining === 1)
  const champions = evaluation.standings.filter(
    (s) => s.status === 'champion' || s.status === 'co-champion',
  )
  const finalists = evaluation.standings.filter((s) => s.status === 'finalist')
  const graveyard = evaluation.standings.filter((s) => s.status === 'eliminated').slice(0, 6)
  const recentOut = graveyard.filter(
    (s) => s.eliminatedWeek !== null && s.eliminatedWeek >= evaluation.currentWeek - 1,
  )
  const games = snapshot.games
    .filter((g) => g.week === evaluation.currentWeek)
    .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))
  const nextKickoff = games.find(
    (g) =>
      g.status === 'scheduled' &&
      new Date(g.kickoffAt).getTime() > new Date(evaluation.evaluatedAt).getTime(),
  )
  const me = session
    ? evaluation.standings.find((s) => s.playerId === session.actor.playerId)
    : undefined
  const hiddenSet = new Set(snapshot.hiddenPicks.map((h) => `${h.playerId}:${h.week}`))
  const pickVisible = (s: PlayerStanding) =>
    !hiddenSet.has(`${s.playerId}:${evaluation.currentWeek}`)

  useConfetti(champions.length > 0)

  return (
    <div className="space-y-10">
      {/* Scoreboard hero */}
      <section className="scoreboard card overflow-hidden p-6 md:p-8" aria-labelledby="hero-title">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">{snapshot.season.label}</p>
            <h1
              id="hero-title"
              className="mt-1 text-5xl font-extrabold leading-none text-ink-50 md:text-7xl"
            >
              Week {evaluation.currentWeek}
            </h1>
            <p className="mt-3 max-w-prose text-ink-200">
              {league.tagline ?? 'One pick. Three lives. Last one standing wins.'}
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-4 text-center md:text-right">
            <Stat label="Still standing" value={alive.length} tone="alive" />
            <Stat label="On the bubble" value={bubble.length} tone="bubble" />
            <Stat label="Eliminated" value={evaluation.eliminatedIds.length} tone="out" />
          </dl>
        </div>
        <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-5 md:flex-row md:items-center md:justify-between">
          <div className="text-ink-200">
            {week?.phase === 'open' && nextKickoff ? (
              <>
                <span className="eyebrow mr-2">Next kickoff</span>
                <Countdown to={nextKickoff.kickoffAt} className="text-2xl text-ink-50" prefix="" />
                <span className="ml-2 text-sm text-ink-300">
                  {getTeam(nextKickoff.awayTeamId)?.name} at {getTeam(nextKickoff.homeTeamId)?.name}{' '}
                  · {formatKickoff(nextKickoff.kickoffAt, { timeZone: tz })}
                </span>
              </>
            ) : week?.phase === 'locked' ? (
              <span>Every game this week has kicked off. Picks are locked.</span>
            ) : week?.phase === 'final' ? (
              <span>Week {evaluation.currentWeek} is in the books.</span>
            ) : (
              <span>
                The schedule for this week hasn’t loaded yet — the commissioner can enter it
                manually.
              </span>
            )}
            {week?.deadlineAt && week.phase === 'open' && (
              <p className="mt-1 text-xs text-ink-400">
                Picks lock {formatKickoff(week.deadlineAt, { timeZone: tz })}
              </p>
            )}
          </div>
          {me && me.status === 'alive' && week?.phase === 'open' && (
            <Button size="lg" asChild>
              <Link to="/pick">
                <Zap className="h-5 w-5" aria-hidden="true" />{' '}
                {me.currentPick ? 'Review my pick' : 'Make my pick'}
              </Link>
            </Button>
          )}
          {!session && (
            <Button size="lg" variant="secondary" asChild>
              <Link to="/sign-in">Sign in to pick</Link>
            </Button>
          )}
        </div>
      </section>

      {champions.length > 0 && (
        <section
          className="card border-gold-400/60 p-6 text-center [--glow:rgba(251,191,36,0.5)] shadow-glow md:p-10"
          aria-labelledby="champ-title"
        >
          <p className="eyebrow text-gold-300">
            {champions.length > 1 ? 'Co-champions' : 'Champion'}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-6">
            {champions.map((c) => {
              const p = profileOf(c.playerId)
              return (
                <Link
                  key={c.playerId}
                  to={`/players/${encodeURIComponent(c.playerId)}`}
                  className="flex flex-col items-center gap-3 focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  <Headshot
                    name={p.displayName}
                    playerId={p.playerId}
                    size="hero"
                    status={c.status}
                  />
                  <span className="font-display text-3xl font-extrabold uppercase text-ink-50">
                    {p.displayName}
                  </span>
                </Link>
              )
            })}
          </div>
          <h2
            id="champ-title"
            className="mt-4 flex items-center justify-center gap-2 text-2xl text-gold-300"
          >
            <Crown className="h-6 w-6" aria-hidden="true" /> Last one standing
          </h2>
        </section>
      )}

      {finalists.length > 0 && (
        <section className="card border-gold-400/40 p-6" aria-labelledby="final-title">
          <h2 id="final-title" className="text-2xl text-gold-300">
            Tied finalists
          </h2>
          <p className="mt-1 text-ink-300">
            Everyone left went down in the same week. The commissioner will record the tiebreaker.
          </p>
          <div className="mt-4 flex flex-wrap gap-4">
            {finalists.map((f) => {
              const p = profileOf(f.playerId)
              return (
                <div key={f.playerId} className="flex items-center gap-3">
                  <Headshot
                    name={p.displayName}
                    playerId={p.playerId}
                    size="md"
                    status="finalist"
                  />
                  <span className="font-display text-lg font-bold uppercase">{p.displayName}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Still standing */}
      <section aria-labelledby="alive-title">
        <div className="mb-4 flex items-end justify-between">
          <h2 id="alive-title" className="text-3xl text-ink-50">
            Still standing <span className="text-ink-400">({alive.length})</span>
          </h2>
          <Link
            to="/leaderboard"
            className="font-display text-sm font-bold uppercase tracking-wide text-sky-400 hover:underline"
          >
            Full leaderboard →
          </Link>
        </div>
        {alive.length === 0 && champions.length === 0 ? (
          <p className="text-ink-300">Nobody is standing. Brutal week.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {alive.map((s, i) => (
              <li key={s.playerId}>
                <PlayerCard
                  standing={s}
                  profile={profileOf(s.playerId)}
                  pickVisible={pickVisible(s)}
                  index={i}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {bubble.length > 0 && (
        <section className="card border-gold-400/30 p-5" aria-labelledby="bubble-title">
          <h2 id="bubble-title" className="flex items-center gap-2 text-2xl text-gold-300">
            <Flame className="h-5 w-5" aria-hidden="true" /> Living dangerously
          </h2>
          <p className="mt-1 text-sm text-ink-300">
            One life left. One more miss and they join the graveyard.
          </p>
          <ul className="mt-4 flex flex-wrap gap-4">
            {bubble.map((s) => {
              const p = profileOf(s.playerId)
              return (
                <li key={s.playerId}>
                  <Link
                    to={`/players/${encodeURIComponent(s.playerId)}`}
                    className="flex items-center gap-3 rounded-full pr-3 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-sky-400"
                  >
                    <Headshot
                      name={p.displayName}
                      playerId={p.playerId}
                      size="sm"
                      status="alive"
                      bubble
                    />
                    <span className="font-display font-bold uppercase text-ink-50">
                      {p.displayName}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* This week's slate */}
      <section aria-labelledby="slate-title">
        <h2 id="slate-title" className="mb-4 text-3xl text-ink-50">
          This week’s slate
        </h2>
        {games.length === 0 ? (
          <p className="text-ink-300">No games loaded for week {evaluation.currentWeek}.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((g) => (
              <li key={g.id}>
                <GameRow game={g} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Graveyard preview */}
      {graveyard.length > 0 && (
        <section aria-labelledby="grave-title">
          <div className="mb-4 flex items-end justify-between">
            <h2 id="grave-title" className="flex items-center gap-2 text-3xl text-ink-50">
              <Skull className="h-6 w-6 text-flag-400" aria-hidden="true" />{' '}
              {recentOut.length > 0 ? 'Fresh graves' : 'Survivor graveyard'}
            </h2>
            <Link
              to="/leaderboard#graveyard"
              className="font-display text-sm font-bold uppercase tracking-wide text-sky-400 hover:underline"
            >
              Pay respects →
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {graveyard.map((s, i) => (
              <li key={s.playerId}>
                <PlayerCard
                  standing={s}
                  profile={profileOf(s.playerId)}
                  pickVisible={viewer.isCommissioner}
                  compact
                  index={i}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'alive' | 'bubble' | 'out'
}) {
  const color = { alive: 'text-turf-400', bubble: 'text-gold-300', out: 'text-flag-400' }[tone]
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className={cn('font-display text-5xl font-extrabold leading-none tabular-nums', color)}>
        {value}
      </dd>
    </div>
  )
}

export function GameRow({ game }: { game: NFLGame }) {
  const tz = useLeagueTimeZone()
  const away = getTeam(game.awayTeamId)
  const home = getTeam(game.homeTeamId)
  const final = game.status === 'final'
  const winner = game.winnerTeamId
  const side = (teamId: string, score: number | undefined) => (
    <div
      className={cn(
        'flex items-center gap-2',
        final && winner && winner !== teamId && 'opacity-50',
      )}
    >
      <TeamMonogram teamId={teamId} size="sm" />
      <span className="font-display font-bold uppercase">{getTeam(teamId)?.name}</span>
      {final && <span className="ml-auto font-display text-lg tabular-nums">{score}</span>}
    </div>
  )
  return (
    <div className="card flex flex-col gap-1.5 p-3 text-sm">
      {side(game.awayTeamId, game.awayScore)}
      {side(game.homeTeamId, game.homeScore)}
      <p className="text-xs text-ink-400">
        {final
          ? winner === null
            ? 'Final · Tie'
            : `Final · ${getTeam(winner ?? '')?.name} win`
          : game.status === 'cancelled'
            ? 'Cancelled'
            : game.status === 'postponed'
              ? `Postponed · ${formatKickoff(game.kickoffAt, { timeZone: tz })}`
              : `${away?.abbreviation} at ${home?.abbreviation} · ${formatKickoff(game.kickoffAt, { timeZone: tz })}`}
        {game.resultSource === 'commissioner' && ' · corrected by commissioner'}
      </p>
    </div>
  )
}
