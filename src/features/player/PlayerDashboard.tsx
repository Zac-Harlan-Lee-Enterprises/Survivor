import { Link } from 'react-router'
import { Zap } from 'lucide-react'
import { useLeagueContext, useLeagueTimeZone } from '@/app/hooks'
import { useSession } from '@/app/hooks'
import { getTeam, weekSummary } from '@/domain'
import { Headshot } from '@/components/Headshot'
import { LivesMeter } from '@/components/LivesMeter'
import { TeamMonogram } from '@/components/TeamMonogram'
import { Countdown } from '@/components/Countdown'
import { OutcomePill } from '@/components/OutcomePill'
import { Button } from '@/components/ui/button'
import { useConfetti } from '@/components/useConfetti'
import { livesLine, statusHeadline, streakLine } from '@/lib/copy'
import { formatKickoff } from '@/lib/time'
import { cn } from '@/lib/cn'

export function PlayerDashboard() {
  const tz = useLeagueTimeZone()
  const session = useSession()
  const { evaluation, profileOf } = useLeagueContext()
  const playerId = session!.actor.playerId
  const me = evaluation.standings.find((s) => s.playerId === playerId)
  const profile = profileOf(playerId)
  const week = weekSummary(evaluation, evaluation.currentWeek)
  useConfetti(me?.status === 'champion' || me?.status === 'co-champion')

  if (!me) {
    return (
      <div className="card p-8 text-center">
        <h1 className="text-3xl text-ink-50">You’re not in this season yet</h1>
        <p className="mt-2 text-ink-300">Ask the commissioner to add you to the league.</p>
      </div>
    )
  }

  const pick = me.currentPick
  const team = pick ? getTeam(pick.teamId) : null
  const game = pick
    ? (me.history.find((h) => h.week === evaluation.currentWeek)?.game ?? null)
    : null
  const current = me.history.find((h) => h.week === evaluation.currentWeek)
  const headlineTone =
    me.status === 'eliminated'
      ? 'text-flag-400'
      : me.status === 'champion' || me.status === 'co-champion'
        ? 'text-gold-300'
        : me.livesRemaining === 1
          ? 'text-gold-300'
          : 'text-turf-400'
  const headline =
    me.status === 'alive' && me.livesRemaining === 1 ? 'On the Bubble' : statusHeadline(me.status)
  const streak = streakLine(me.streak)
  const others = evaluation.standings
    .filter((s) => s.playerId !== playerId && s.status !== 'inactive')
    .slice(0, 6)

  return (
    <div className="space-y-8">
      <section
        className={cn(
          'card flex flex-col items-center gap-5 p-6 text-center md:flex-row md:text-left',
          me.status === 'eliminated' && 'graveyard',
        )}
        aria-labelledby="me-title"
      >
        <Headshot
          name={profile.displayName}
          playerId={profile.playerId}
          size="xl"
          status={me.status}
          bubble={me.livesRemaining === 1}
        />
        <div className="flex-1">
          <p className="eyebrow">{profile.nickname ? `“${profile.nickname}”` : 'Survivor'}</p>
          <h1 id="me-title" className="text-4xl font-extrabold text-ink-50 md:text-5xl">
            {profile.displayName}
          </h1>
          <p
            className={cn(
              'mt-2 font-display text-3xl font-extrabold uppercase md:text-4xl',
              headlineTone,
            )}
          >
            {headline}
          </p>
          <p className="mt-1 text-ink-200">
            {livesLine(me)}
            {streak ? ` ${streak}` : ''}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-4 md:justify-start">
            <LivesMeter total={me.livesTotal} remaining={me.livesRemaining} size="lg" />
            <span className="text-sm text-ink-300">
              {me.weeksSurvived} week{me.weeksSurvived === 1 ? '' : 's'} survived · {me.wins} win
              {me.wins === 1 ? '' : 's'} · {me.teamsRemaining.length} teams left
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-5">
        <section className="card p-6 md:col-span-3" aria-labelledby="pick-title">
          <p className="eyebrow">Week {evaluation.currentWeek}</p>
          <h2 id="pick-title" className="mt-1 text-3xl text-ink-50">
            Your pick
          </h2>
          {me.status !== 'alive' ? (
            <p className="mt-3 text-ink-300">
              {me.status === 'eliminated'
                ? 'Your season is over — but the graveyard has the best seats.'
                : 'No pick needed. Enjoy the view from the top.'}
            </p>
          ) : pick && team ? (
            <div className="mt-4 flex items-center gap-4">
              <TeamMonogram teamId={team.id} size="xl" />
              <div>
                <p className="font-display text-3xl font-extrabold uppercase text-ink-50">
                  {team.fullName}
                </p>
                {game && (
                  <p className="text-ink-300">
                    {game.homeTeamId === team.id ? 'vs' : 'at'}{' '}
                    {getTeam(game.homeTeamId === team.id ? game.awayTeamId : game.homeTeamId)?.name}{' '}
                    · {formatKickoff(game.kickoffAt, { timeZone: tz })}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-3">
                  {current && <OutcomePill outcome={current.outcome} />}
                  {game && !current?.locked && (
                    <Countdown to={game.kickoffAt} className="text-ink-200" />
                  )}
                  {current?.locked && <span className="text-sm text-ink-300">Locked in.</span>}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-ink-200">
              No pick yet.{' '}
              {week?.deadlineAt
                ? `Picks lock ${formatKickoff(week.deadlineAt, { timeZone: tz })}.`
                : ''}
            </p>
          )}
          {me.status === 'alive' && week?.phase === 'open' && (
            <Button className="mt-5" size="lg" asChild>
              <Link to="/pick">
                <Zap className="h-5 w-5" aria-hidden="true" />{' '}
                {pick ? (current?.locked ? 'View pick' : 'Change my pick') : 'Make my pick'}
              </Link>
            </Button>
          )}
          <p className="mt-4 text-xs text-ink-400">
            <Link to="/my-season" className="text-sky-400 hover:underline">
              My season
            </Link>{' '}
            — every team you’ve used and everything still in the tank.
          </p>
        </section>

        <section className="card p-6 md:col-span-2" aria-labelledby="quick-title">
          <h2 id="quick-title" className="text-2xl text-ink-50">
            Around the league
          </h2>
          <ol className="mt-3 space-y-2">
            {others.map((s) => {
              const p = profileOf(s.playerId)
              return (
                <li
                  key={s.playerId}
                  className={cn(
                    'flex items-center gap-3',
                    s.status === 'eliminated' && 'opacity-60',
                  )}
                >
                  <span className="w-5 text-right font-display text-ink-400">{s.rank}</span>
                  <Headshot
                    name={p.displayName}
                    playerId={p.playerId}
                    size="xs"
                    status={s.status}
                  />
                  <Link
                    to={`/players/${encodeURIComponent(s.playerId)}`}
                    className="flex-1 truncate font-medium text-ink-100 hover:underline"
                  >
                    {p.displayName}
                  </Link>
                  {s.status === 'inactive' ? null : (
                    <LivesMeter total={s.livesTotal} remaining={s.livesRemaining} size="sm" />
                  )}
                </li>
              )
            })}
          </ol>
          <Link
            to="/leaderboard"
            className="mt-4 inline-block font-display text-sm font-bold uppercase tracking-wide text-sky-400 hover:underline"
          >
            Full leaderboard →
          </Link>
        </section>
      </div>
    </div>
  )
}
