import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { PlayerStanding } from '@/domain'
import { causeOfDeath } from '@/lib/copy'
import { cn } from '@/lib/cn'
import { Funeral, FUNERAL_MS } from './Funeral'
import { StoneFace } from './StoneFace'

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
   * Play the funeral (see Funeral.tsx): the face shatters and the stone rises
   * in its place. It waits until the stone is properly on screen — the
   * graveyard sits well down the league page, and a funeral nobody scrolled to
   * see is wasted — then plays once per page load. Viewers who prefer reduced
   * motion just see the stone.
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
  // A card-sized stone carries the killing blow; the hero stone has room for the whole story.
  const carved = size === 'hero' ? cause : cause?.replace(/ Complications:.*$/, '')
  const detail = DETAIL[size]
  const label = `Headstone of ${name}, eliminated in week ${week}.${cause ? ` ${cause}` : ''}`
  const { ref, phase } = useFuneral(!!funeral)
  const staged = phase === 'waiting' || phase === 'playing'

  /** Each carved line, numbered so the funeral can chisel them in order. */
  const engraved = (i: number, cls: string, text: string) => (
    <span aria-hidden="true" className={cn('engrave', cls)} style={{ '--i': i } as CSSProperties}>
      {text}
    </span>
  )

  const stone = (
    <div
      role="img"
      aria-label={label}
      className={cn('headstone relative h-full w-full', staged && 'funeral-stone')}
    >
      <StoneFace uid={playerId} />
      <div className="headstone-face flex flex-col items-center justify-center text-center">
        {engraved(
          0,
          cn(
            'font-display font-extrabold tracking-[0.2em]',
            detail === 'rip' ? 'text-[0.62rem] sm:text-xs' : 'text-sm md:text-lg',
          ),
          'RIP',
        )}
        {detail !== 'rip' &&
          engraved(
            1,
            cn(
              'w-full font-display font-bold uppercase leading-tight',
              detail === 'name' ? 'truncate text-[0.65rem]' : 'text-sm md:text-lg',
            ),
            detail === 'name' ? name.split(' ')[0]! : name,
          )}
        {detail !== 'rip' &&
          week !== null &&
          engraved(
            2,
            'font-display text-[0.62rem] font-semibold tracking-wide md:text-xs',
            week === 1 ? 'Week 1' : `Weeks 1–${week}`,
          )}
        {detail === 'full' &&
          carved &&
          engraved(
            3,
            'engrave-soft mt-1 line-clamp-3 font-display text-[0.62rem] leading-snug md:text-xs',
            carved,
          )}
      </div>
      {staged && <span aria-hidden="true" className="funeral-glint" />}
    </div>
  )

  return (
    <div
      ref={ref}
      className={cn('relative shrink-0', SIZES[size], staged && 'z-30', className)}
      data-funeral={funeral ? phase : undefined}
    >
      {staged ? (
        <Funeral
          name={name}
          playerId={playerId}
          standing={standing}
          size={size}
          playing={phase === 'playing'}
        >
          {stone}
        </Funeral>
      ) : (
        stone
      )}
    </div>
  )
}

type Phase = 'waiting' | 'playing' | 'done' | 'skipped'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The funeral's lifecycle. It waits, face intact, until the stone is mostly on
 * screen; plays once; then steps aside for the plain stone it ended on. Viewers
 * who asked for reduced motion skip straight to the stone. Without
 * IntersectionObserver there is no way to know what is on screen, so it plays.
 */
function useFuneral(funeral: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<Phase>(() =>
    !funeral || prefersReducedMotion()
      ? 'skipped'
      : typeof IntersectionObserver === 'undefined'
        ? 'playing'
        : 'waiting',
  )
  useEffect(() => {
    const el = ref.current
    if (phase !== 'waiting' || !el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setPhase('playing')
          observer.disconnect()
        }
      },
      { threshold: 0.75 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [phase])
  useEffect(() => {
    if (phase !== 'playing') return
    const t = window.setTimeout(() => setPhase('done'), FUNERAL_MS)
    return () => window.clearTimeout(t)
  }, [phase])
  return { ref, phase }
}
