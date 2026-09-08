import { Link } from 'react-router'
import { Crown, Skull } from 'lucide-react'
import { useLeagueContext } from '@/app/hooks'
import { getTeam, type PlayerStanding } from '@/domain'
import { Headshot } from '@/components/Headshot'
import { LivesMeter } from '@/components/LivesMeter'
import { StatusBadge } from '@/components/StatusBadge'
import { TeamMonogram } from '@/components/TeamMonogram'
import { OutcomePill } from '@/components/OutcomePill'
import { useConfetti } from '@/components/useConfetti'
import { cn } from '@/lib/cn'

export function Leaderboard() {
  const { evaluation, profileOf, snapshot } = useLeagueContext()
  const champions = evaluation.standings.filter(
    (s) => s.status === 'champion' || s.status === 'co-champion',
  )
  const survivors = evaluation.standings.filter(
    (s) => s.status === 'alive' || s.status === 'finalist',
  )
  const graveyard = evaluation.standings.filter((s) => s.status === 'eliminated')
  const inactive = evaluation.standings.filter((s) => s.status === 'inactive')
  const hidden = new Set(snapshot.hiddenPicks.map((h) => `${h.playerId}:${h.week}`))
  useConfetti(champions.length > 0)

  return (
    <div className="space-y-10">
      <header>
        <p className="eyebrow">
          {snapshot.season.label} · through week {Math.max(evaluation.currentWeek - 1, 0)}
        </p>
        <h1 className="text-4xl font-extrabold text-ink-50 md:text-5xl">Leaderboard</h1>
      </header>

      {champions.length > 0 && (
        <section
          className="card border-gold-400/60 p-6 [--glow:rgba(251,191,36,0.5)] shadow-glow"
          aria-labelledby="lb-champ"
        >
          <h2 id="lb-champ" className="flex items-center gap-2 text-2xl text-gold-300">
            <Crown className="h-6 w-6" aria-hidden="true" />{' '}
            {champions.length > 1 ? 'Co-champions' : 'Champion'}
          </h2>
          <ul className="mt-4 flex flex-wrap gap-6">
            {champions.map((s) => (
              <li key={s.playerId}>
                <Row
                  standing={s}
                  profile={profileOf(s.playerId)}
                  pickHidden={hidden.has(`${s.playerId}:${evaluation.currentWeek}`)}
                  hero
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="lb-alive">
        <h2 id="lb-alive" className="mb-3 text-3xl text-ink-50">
          Survivors <span className="text-ink-400">({survivors.length})</span>
        </h2>
        {survivors.length === 0 ? (
          <p className="text-ink-300">No survivors remain.</p>
        ) : (
          <ol className="space-y-2">
            {survivors.map((s) => (
              <li key={s.playerId}>
                <Row
                  standing={s}
                  profile={profileOf(s.playerId)}
                  pickHidden={hidden.has(`${s.playerId}:${evaluation.currentWeek}`)}
                />
              </li>
            ))}
          </ol>
        )}
      </section>

      <section
        id="graveyard"
        aria-labelledby="lb-grave"
        className="rounded-3xl border border-flag-500/20 bg-pitch-950/60 p-4 md:p-6"
      >
        <h2 id="lb-grave" className="mb-1 flex items-center gap-2 text-3xl text-ink-50">
          <Skull className="h-7 w-7 text-flag-400" aria-hidden="true" /> Survivor graveyard{' '}
          <span className="text-ink-400">({graveyard.length})</span>
        </h2>
        <p className="mb-4 text-sm text-ink-400">Here lie the fallen. Most recent first.</p>
        {graveyard.length === 0 ? (
          <p className="text-ink-300">Empty. For now.</p>
        ) : (
          <ol className="space-y-2">
            {graveyard.map((s) => (
              <li key={s.playerId} className="graveyard">
                <Row standing={s} profile={profileOf(s.playerId)} pickHidden={false} />
              </li>
            ))}
          </ol>
        )}
      </section>

      {inactive.length > 0 && (
        <section aria-labelledby="lb-inactive">
          <h2 id="lb-inactive" className="mb-3 text-xl text-ink-300">
            Inactive
          </h2>
          <ul className="flex flex-wrap gap-3 text-sm text-ink-400">
            {inactive.map((s) => (
              <li key={s.playerId}>{profileOf(s.playerId).displayName}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Row({
  standing: s,
  profile,
  pickHidden,
  hero,
}: {
  standing: PlayerStanding
  profile: ReturnType<ReturnType<typeof useLeagueContext>['profileOf']>
  pickHidden: boolean
  hero?: boolean
}) {
  const pick = s.currentPick
  const team = pick ? getTeam(pick.teamId) : null
  const current =
    s.history.find((h) => h.week === (s.eliminatedWeek ?? Infinity)) ??
    s.history.findLast((h) => h.outcome !== 'not_required')
  return (
    <div
      className={cn(
        'card flex flex-col gap-3 p-3 md:flex-row md:items-center md:gap-4',
        hero && 'border-gold-400/40',
      )}
    >
      <div className="flex items-center gap-3 md:w-72">
        <span
          className="w-6 text-center font-display text-lg text-ink-400"
          aria-label={`Rank ${s.rank}`}
        >
          {s.rank}
        </span>
        <Headshot
          name={profile.displayName}
          playerId={profile.playerId}
          size={hero ? 'lg' : 'md'}
          status={s.status}
          bubble={s.livesRemaining === 1}
          desaturate={s.status === 'eliminated'}
        />
        <div className="min-w-0">
          <Link
            to={`/players/${encodeURIComponent(s.playerId)}`}
            className="block truncate font-display text-xl font-bold uppercase text-ink-50 hover:underline"
          >
            {profile.displayName}
          </Link>
          <StatusBadge standing={s} />
        </div>
      </div>
      <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="eyebrow">Lives</dt>
          <dd>
            <LivesMeter total={s.livesTotal} remaining={s.livesRemaining} size="sm" />
          </dd>
        </div>
        <div>
          <dt className="eyebrow">Strikes</dt>
          <dd className="font-display text-xl">
            {s.strikes}
            <span className="text-ink-400">/{s.livesTotal}</span>
          </dd>
        </div>
        <div>
          <dt className="eyebrow">
            {s.status === 'eliminated' ? `Week ${s.eliminatedWeek} pick` : 'This week'}
          </dt>
          <dd className="flex items-center gap-2">
            {s.status === 'eliminated' && current?.pick ? (
              <>
                <TeamMonogram teamId={current.pick.teamId} size="xs" />{' '}
                {getTeam(current.pick.teamId)?.abbreviation}{' '}
                <OutcomePill outcome={current.outcome} />
              </>
            ) : team ? (
              <>
                <TeamMonogram teamId={team.id} size="xs" /> {team.abbreviation}
                {s.currentOutcome !== 'pending' && <OutcomePill outcome={s.currentOutcome} />}
              </>
            ) : pickHidden ? (
              <span className="text-ink-300">Locked in 🔒</span>
            ) : (
              <span className="text-ink-400">—</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="eyebrow">Teams used</dt>
          <dd className="flex flex-wrap gap-1">
            <span className="sr-only">
              {s.teamsUsed.length === 0 ? 'none' : s.teamsUsed.join(', ')}
            </span>
            {s.teamsUsed.length === 0 ? (
              <span className="text-ink-400" aria-hidden="true">
                None
              </span>
            ) : (
              s.teamsUsed.map((t) => <TeamMonogram key={t} teamId={t} size="xs" />)
            )}
          </dd>
        </div>
      </dl>
    </div>
  )
}
