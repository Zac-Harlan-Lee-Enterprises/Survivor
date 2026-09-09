import { Link, useParams } from 'react-router'
import { useLeagueContext } from '@/app/hooks'
import { getTeam } from '@/domain'
import { Headshot } from '@/components/Headshot'
import { LivesMeter } from '@/components/LivesMeter'
import { OutcomePill } from '@/components/OutcomePill'
import { StatusBadge } from '@/components/StatusBadge'
import { TeamMonogram } from '@/components/TeamMonogram'
import { NotFound } from '@/features/NotFound'
import { useConfetti } from '@/components/useConfetti'
import { livesLine, streakLine } from '@/lib/copy'
import { cn } from '@/lib/cn'

/** A sports-card style profile: the person, their status, and their record. */
export function PlayerProfilePage() {
  const { playerId = '' } = useParams()
  const { evaluation, profileOf, snapshot, viewer } = useLeagueContext()
  const standing = evaluation.standings.find((s) => s.playerId === playerId)
  const isChamp = standing?.status === 'champion' || standing?.status === 'co-champion'
  useConfetti(!!isChamp)
  if (!standing) return <NotFound />
  const profile = profileOf(playerId)
  const hidden = snapshot.hiddenPicks.some(
    (h) => h.playerId === playerId && h.week === evaluation.currentWeek,
  )
  const pick = standing.currentPick
  const team = pick ? getTeam(pick.teamId) : null
  const history = standing.history.filter(
    (h) => h.week < evaluation.currentWeek || h.pick || h.outcome === 'missing',
  )
  const isMe = viewer.playerId === playerId
  const streak = streakLine(standing.streak)

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <section
        className={cn(
          'card relative overflow-hidden p-6 md:p-8',
          standing.status === 'eliminated' && 'graveyard',
          isChamp && 'border-gold-400/60 [--glow:rgba(251,191,36,0.5)] shadow-glow',
        )}
        aria-labelledby="profile-title"
      >
        <div
          className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/5 to-transparent"
          aria-hidden="true"
        />
        <div className="relative flex flex-col items-center gap-5 text-center md:flex-row md:text-left">
          <Headshot
            name={profile.displayName}
            playerId={profile.playerId}
            size="hero"
            status={standing.status}
            bubble={standing.livesRemaining === 1}
          />
          <div className="flex-1">
            <p className="eyebrow">Player card · #{standing.rank}</p>
            <h1 id="profile-title" className="text-4xl font-extrabold text-ink-50 md:text-6xl">
              {profile.displayName}
            </h1>
            {profile.nickname && (
              <p className="font-display text-2xl text-gold-300">“{profile.nickname}”</p>
            )}
            {profile.tagline && <p className="mt-1 text-ink-300">{profile.tagline}</p>}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-3 md:justify-start">
              <StatusBadge standing={standing} />
              {standing.status !== 'inactive' && (
                <LivesMeter
                  total={standing.livesTotal}
                  remaining={standing.livesRemaining}
                  size="lg"
                />
              )}
            </div>
            <p className="mt-2 text-ink-200">
              {livesLine(standing)}
              {streak ? ` ${streak}` : ''}
            </p>
          </div>
        </div>
        <dl className="relative mt-6 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          <Stat label="Weeks survived" value={standing.weeksSurvived} />
          <Stat label="Wins" value={standing.wins} />
          <Stat label="Strikes" value={standing.strikes} />
          <Stat label="Teams left" value={standing.teamsRemaining.length} />
        </dl>
      </section>

      <section className="card p-5" aria-labelledby="current-title">
        <h2 id="current-title" className="text-2xl text-ink-50">
          Week {evaluation.currentWeek} pick
        </h2>
        {team ? (
          <div className="mt-3 flex items-center gap-3">
            <TeamMonogram teamId={team.id} size="lg" />
            <div>
              <p className="font-display text-2xl font-extrabold uppercase text-ink-50">
                {team.fullName}
              </p>
              <OutcomePill outcome={standing.currentOutcome} />
            </div>
          </div>
        ) : hidden ? (
          <p className="mt-2 text-ink-300">Locked in — hidden until the pick deadline. 🔒</p>
        ) : standing.status === 'alive' ? (
          <p className="mt-2 text-ink-400">No pick yet.</p>
        ) : (
          <p className="mt-2 text-ink-400">Not required.</p>
        )}
        {isMe && standing.status === 'alive' && (
          <Link
            to="/pick"
            className="mt-3 inline-block font-display text-sm font-bold uppercase text-sky-400 hover:underline"
          >
            Go to my pick →
          </Link>
        )}
      </section>

      <section aria-labelledby="ph-title">
        <h2 id="ph-title" className="mb-3 text-2xl text-ink-50">
          Pick history
        </h2>
        {history.length === 0 ? (
          <p className="text-ink-300">Nothing on the record yet.</p>
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

      <section aria-labelledby="tr-title">
        <h2 id="tr-title" className="mb-3 text-2xl text-ink-50">
          Teams remaining <span className="text-ink-400">({standing.teamsRemaining.length})</span>
        </h2>
        <ul className="flex flex-wrap gap-2">
          {standing.teamsRemaining.map((t) => (
            <li key={t}>
              <TeamMonogram teamId={t} size="sm" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-pitch-900/60 p-3">
      <dt className="eyebrow">{label}</dt>
      <dd className="font-display text-3xl font-extrabold text-ink-50">{value}</dd>
    </div>
  )
}
