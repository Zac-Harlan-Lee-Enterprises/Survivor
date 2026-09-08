import { Link } from 'react-router'
import type { PlayerProfile, PlayerStanding } from '@/domain'
import { getTeam } from '@/domain'
import { livesLine } from '@/lib/copy'
import { cn } from '@/lib/cn'
import { Headshot } from './Headshot'
import { LivesMeter } from './LivesMeter'
import { OutcomePill } from './OutcomePill'
import { StatusBadge } from './StatusBadge'
import { TeamMonogram } from './TeamMonogram'

export interface PlayerCardProps {
  standing: PlayerStanding
  profile: PlayerProfile
  /** Whether the viewer may see this player's current pick. */
  pickVisible: boolean
  compact?: boolean
  index?: number
}

export function PlayerCard({
  standing,
  profile,
  pickVisible,
  compact,
  index = 0,
}: PlayerCardProps) {
  const out = standing.status === 'eliminated'
  const champ = standing.status === 'champion' || standing.status === 'co-champion'
  const pick = standing.currentPick
  const team = pick ? getTeam(pick.teamId) : null
  return (
    <Link
      to={`/players/${encodeURIComponent(standing.playerId)}`}
      className={cn(
        'card group relative flex animate-rise flex-col items-center gap-2 p-4 text-center transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-sky-400',
        out && 'graveyard',
        champ && 'border-gold-400/60 [--glow:rgba(251,191,36,0.45)] shadow-glow',
      )}
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
      aria-label={`${profile.displayName}: ${standing.status === 'alive' ? `${standing.livesRemaining} lives left` : standing.status}`}
    >
      <Headshot
        name={profile.displayName}
        playerId={profile.playerId}
        size={compact ? 'md' : 'lg'}
        status={standing.status}
        bubble={standing.livesRemaining === 1}
        desaturate={out}
      />
      <div className="min-w-0">
        <p className="truncate font-display text-lg font-bold uppercase leading-tight text-ink-50">
          {profile.displayName}
        </p>
        {profile.nickname && !compact && (
          <p className="truncate text-xs text-ink-300">“{profile.nickname}”</p>
        )}
      </div>
      <StatusBadge standing={standing} />
      {standing.status !== 'inactive' && (
        <LivesMeter total={standing.livesTotal} remaining={standing.livesRemaining} size="sm" />
      )}
      {!compact && <p className="text-xs text-ink-300">{livesLine(standing)}</p>}
      {!compact && standing.status === 'alive' && (
        <div className="mt-1 flex items-center gap-2 text-xs text-ink-200">
          {pick && team ? (
            <>
              <TeamMonogram teamId={team.id} size="xs" /> <span>Riding {team.name}</span>
              {standing.currentOutcome !== 'pending' && (
                <OutcomePill outcome={standing.currentOutcome} />
              )}
            </>
          ) : !pickVisible ? (
            <span className="italic text-ink-300">Locked in 🔒</span>
          ) : (
            <span className="italic text-ink-400">No pick yet</span>
          )}
        </div>
      )}
    </Link>
  )
}
