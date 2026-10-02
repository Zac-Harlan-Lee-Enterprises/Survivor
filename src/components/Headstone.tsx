import { useEffect, useRef, useState } from 'react'
import type { PlayerStanding } from '@/domain'
import { causeOfDeath } from '@/lib/copy'
import { cn } from '@/lib/cn'
import { Headshot } from './Headshot'

/** Same footprint as Headshot's sizes, so a headstone drops in where a face was. */
const SIZES = {
  xs: 'h-8 w-8',
  sm: 'h-12 w-12',
  md: 'h-16 w-16',
  lg: 'h-24 w-24',
  xl: 'h-36 w-36 md:h-44 md:w-44',
  hero: 'h-44 w-44 md:h-60 md:w-60',
} as const

type Size = keyof typeof SIZES

/** How much engraving fits: a thumbnail gets "RIP", a hero gets the whole story. */
const DETAIL: Record<Size, 'rip' | 'name' | 'full'> = {
  xs: 'rip',
  sm: 'rip',
  md: 'rip',
  lg: 'name',
  xl: 'full',
  hero: 'full',
}

export interface HeadstoneProps {
  name: string
  playerId: string
  standing: PlayerStanding
  size?: Size
  /**
   * Play the funeral: the headshot crumbles away and the stone rises in its
   * place. It waits until the stone is properly on screen — the graveyard sits
   * well down the league page, and a funeral nobody scrolled to see is wasted —
   * then plays once per page load. Under prefers-reduced-motion the global rule
   * in index.css collapses it to the final frame, so those viewers simply see
   * the stone.
   */
  funeral?: boolean
  className?: string
}

/** What an eliminated player becomes: a headstone engraved with how they went. */
export function Headstone({
  name,
  playerId,
  standing,
  size = 'md',
  funeral,
  className,
}: HeadstoneProps) {
  const week = standing.eliminatedWeek
  const cause = causeOfDeath(standing)
  const detail = DETAIL[size]
  const label = `Headstone of ${name}, eliminated in week ${week}.${cause ? ` ${cause}` : ''}`
  const { ref, playing } = useFuneralInView(!!funeral)

  return (
    <div
      ref={ref}
      className={cn('relative shrink-0', SIZES[size], className)}
      data-funeral={funeral ? (playing ? 'playing' : 'waiting') : undefined}
    >
      <div
        role="img"
        aria-label={label}
        className={cn(
          'headstone flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-t-full rounded-b-md px-[8%] pt-[14%] pb-[6%] text-center',
          funeral && (playing ? 'animate-stone-rise' : 'opacity-0'),
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'font-display font-extrabold tracking-[0.2em] text-ink-100',
            detail === 'rip' ? 'text-[0.6rem] sm:text-xs' : 'text-sm md:text-lg',
          )}
        >
          RIP
        </span>
        {detail !== 'rip' && (
          <span
            aria-hidden="true"
            className={cn(
              'w-full font-display font-bold uppercase leading-tight text-ink-50',
              detail === 'name' ? 'truncate text-[0.65rem]' : 'text-sm md:text-lg',
            )}
          >
            {detail === 'name' ? name.split(' ')[0] : name}
          </span>
        )}
        {detail !== 'rip' && week !== null && (
          <span aria-hidden="true" className="text-[0.6rem] text-ink-300 md:text-xs">
            {week === 1 ? 'Week 1' : `Weeks 1–${week}`}
          </span>
        )}
        {detail === 'full' && cause && (
          <span
            aria-hidden="true"
            className="mt-1 line-clamp-3 text-[0.6rem] italic leading-snug text-ink-300 md:text-xs"
          >
            {cause}
          </span>
        )}
      </div>
      {funeral && (
        <div
          aria-hidden="true"
          className={cn('funeral-face absolute inset-0', playing && 'animate-crumble')}
        >
          <Headshot name={name} playerId={playerId} size={size} status="eliminated" />
        </div>
      )}
    </div>
  )
}

/**
 * Starts the funeral once the stone is mostly on screen, then stops watching.
 * Until then the face sits there, intact, with the stone hidden behind it.
 * Without IntersectionObserver there is no way to know, so it just plays.
 */
function useFuneralInView(funeral: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(
    () => funeral && typeof IntersectionObserver === 'undefined',
  )
  useEffect(() => {
    const el = ref.current
    if (!funeral || playing || !el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setPlaying(true)
          observer.disconnect()
        }
      },
      { threshold: 0.75 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [funeral, playing])
  return { ref, playing }
}
