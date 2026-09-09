import { useState } from 'react'
import { getTeam, readableTextColor } from '@/domain'
import { getConfig } from '@/config/env'
import { cn } from '@/lib/cn'

const DIMS = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-xl',
  xl: 'h-24 w-24 text-3xl',
} as const

export interface TeamMarkProps {
  teamId: string
  size?: keyof typeof DIMS
  className?: string
  muted?: boolean
}

/**
 * A team's crest. Falls back to a team-coloured monogram if the logo asset is
 * missing or fails to load, so a broken image never leaves a blank hole.
 * Logos are fetched by `npm run logos:fetch` into public/team-logos/.
 */
export function TeamMonogram({ teamId, size = 'md', className, muted }: TeamMarkProps) {
  const [failed, setFailed] = useState(false)
  const team = getTeam(teamId)
  if (!team) return null
  const dims = DIMS[size]

  if (!failed) {
    return (
      <img
        src={`${getConfig().basePath}team-logos/${team.id.toLowerCase()}.png`}
        alt=""
        aria-hidden="true"
        width={160}
        height={160}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={cn('shrink-0 object-contain', dims, muted && 'opacity-50 grayscale', className)}
      />
    )
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-xl font-display font-extrabold tracking-wider shadow-inner',
        dims,
        muted && 'opacity-50 grayscale',
        className,
      )}
      style={{
        background: `linear-gradient(135deg, ${team.colors.primary}, ${team.colors.secondary})`,
        color: readableTextColor(team.colors.primary),
        boxShadow: `inset 0 0 0 2px ${team.colors.secondary}55`,
      }}
      aria-hidden="true"
    >
      {team.abbreviation}
    </span>
  )
}
