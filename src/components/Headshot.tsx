import { useState } from 'react'
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
  const { imageOf } = useLeagueContext()
  const [failed, setFailed] = useState(false)
  const variant = size === 'xs' || size === 'sm' || size === 'md' ? 'thumb' : 'medium'
  const image = imageOf(playerId)
  const src = failed ? images.defaultAvatarUrl() : images.variantUrl(image, variant)
  const ring = status
    ? bubble && status === 'alive'
      ? 'ring-gold-400'
      : RINGS[status]
    : 'ring-white/10'
  return (
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
}
