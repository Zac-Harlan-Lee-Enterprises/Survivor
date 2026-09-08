import { getTeam, readableTextColor } from '@/domain'
import { cn } from '@/lib/cn'

/**
 * Team-colour monogram. No proprietary logos are bundled; the abbreviation on
 * the team's colours is instantly recognisable to fans and rights-safe.
 */
export function TeamMonogram({
  teamId,
  size = 'md',
  className,
  muted,
}: {
  teamId: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  muted?: boolean
}) {
  const team = getTeam(teamId)
  if (!team) return null
  const dims = {
    xs: 'h-6 w-6 text-[10px]',
    sm: 'h-8 w-8 text-xs',
    md: 'h-11 w-11 text-sm',
    lg: 'h-16 w-16 text-xl',
    xl: 'h-24 w-24 text-3xl',
  }[size]
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
