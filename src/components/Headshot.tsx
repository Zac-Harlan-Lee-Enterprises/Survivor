import { useId, useState } from 'react'
import type { SurvivorStatus } from '@/domain'
import { useLeagueContext, useServices } from '@/app/hooks'
import { cn } from '@/lib/cn'

const SIZES = {
  xs: 'h-8 w-8',
  sm: 'h-12 w-12',
  md: 'h-16 w-16',
  lg: 'h-24 w-24',
  xl: 'h-36 w-36 md:h-44 md:w-44',
  hero: 'h-44 w-44 md:h-60 md:w-60',
} as const

const RINGS: Record<SurvivorStatus, string> = {
  champion: 'ring-gold-400 shadow-[0_0_40px_-6px_rgba(251,191,36,0.9)]',
  'co-champion': 'ring-gold-400 shadow-[0_0_40px_-6px_rgba(251,191,36,0.9)]',
  finalist: 'ring-gold-300',
  alive: 'ring-turf-500',
  eliminated: 'ring-flag-600',
  inactive: 'ring-ink-400',
}

export interface HeadshotProps {
  name: string
  playerId: string
  size?: keyof typeof SIZES
  status?: SurvivorStatus
  /** 'bubble' ring for one life left */
  bubble?: boolean
  className?: string
  desaturate?: boolean
}

/** A participant headshot with status ring and default-avatar fallback. */
export function Headshot({
  name,
  playerId,
  size = 'md',
  status,
  bubble,
  className,
  desaturate,
}: HeadshotProps) {
  const { images } = useServices()
  const { imageOf, evaluation } = useLeagueContext()
  const [failed, setFailed] = useState(false)
  // The champion wears the crown on every page, for the rest of the season.
  const crowned = !!evaluation?.championIds.includes(playerId)
  const variant = size === 'xs' || size === 'sm' || size === 'md' ? 'thumb' : 'medium'
  const image = imageOf(playerId)
  const src = failed ? images.defaultAvatarUrl() : images.variantUrl(image, variant)
  const ring = status
    ? bubble && status === 'alive'
      ? 'ring-gold-400'
      : RINGS[status]
    : 'ring-white/10'
  const face = (
    <img
      src={src}
      alt={`Headshot of ${name}`}
      width={256}
      height={256}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn(
        'shrink-0 rounded-full bg-pitch-700 object-cover ring-[3px]',
        SIZES[size],
        ring,
        desaturate && 'grayscale',
        className,
      )}
    />
  )
  if (!crowned) return face
  return (
    <span className="relative inline-flex shrink-0">
      {face}
      <ChampionCrown />
    </span>
  )
}

/** A small gold crown, set at an angle on the champion's headshot. */
export function ChampionCrown() {
  // (Its own gradient id: a shared one breaks when the first copy is hidden.)
  const gold = `crown-gold-${useId().replace(/:/g, '')}`
  return (
    <svg
      className="champion-crown"
      viewBox="0 0 64 48"
      role="img"
      aria-label="Champion"
      focusable="false"
    >
      <title>Champion</title>
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fef3c7" />
          <stop offset="0.45" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <path
        d="M6 40 L3 12 L19 25 L32 4 L45 25 L61 12 L58 40 Z"
        fill={`url(#${gold})`}
        stroke="#78350f"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect
        x="6"
        y="38"
        width="52"
        height="7"
        rx="2"
        fill={`url(#${gold})`}
        stroke="#78350f"
        strokeWidth="2"
      />
      <circle cx="3" cy="12" r="3.2" fill="#fde68a" stroke="#78350f" strokeWidth="1.5" />
      <circle cx="32" cy="4" r="3.6" fill="#fde68a" stroke="#78350f" strokeWidth="1.5" />
      <circle cx="61" cy="12" r="3.2" fill="#fde68a" stroke="#78350f" strokeWidth="1.5" />
      <circle cx="32" cy="29" r="3.4" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1" />
    </svg>
  )
}
