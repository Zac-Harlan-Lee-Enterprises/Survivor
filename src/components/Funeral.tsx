import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { getTeam, type PlayerStanding } from '@/domain'
import { Headshot } from './Headshot'

/**
 * The funeral: a short film played over a fresh grave.
 *
 *   lights dim, a beam falls, ash drifts      0.0s
 *   captions: "Week 3." "The 49ers lost."     0.4s
 *   colour drains, the heart slows            0.2–2.4s
 *   cracks spread from one point              2.2–3.2s
 *   "Strike three." — flash, the face shatters 3.3s
 *   dust; earth heaps; the stone grinds up    4.4–6.9s
 *   the epitaph is chiselled, line by line    6.9–8.6s
 *   a glint crosses the stone                 8.9s
 *   the ghost rises out of the grave          7.6–10.8s
 *   "Rest in peace, Nate." Lights up.         9.4–11.6s
 *
 * All motion is CSS (index.css, `.funeral.is-playing …`), driven by one class
 * toggle, so the browser composites it and nothing re-renders mid-scene. The
 * whole scene is aria-hidden: the stone it reveals carries the meaning.
 */
export const FUNERAL_MS = 11_800

/** Where the blow lands — every crack starts here. Percent of the frame. */
const IMPACT = { x: 46, y: 40 }

/** Where the radial cracks meet the edge of the frame, clockwise from the top. */
const RIM: Array<{ x: number; y: number; corner?: { x: number; y: number } }> = [
  { x: 24, y: 0 },
  { x: 74, y: 0, corner: { x: 100, y: 0 } },
  { x: 100, y: 38 },
  { x: 100, y: 84, corner: { x: 100, y: 100 } },
  { x: 66, y: 100 },
  { x: 18, y: 100, corner: { x: 0, y: 100 } },
  { x: 0, y: 70 },
  { x: 0, y: 22, corner: { x: 0, y: 0 } },
]

/** Where the ring crack crosses each radial one: a little uneven, like glass. */
const RING = RIM.map((p, i) => {
  const t = i % 2 === 0 ? 0.42 : 0.52
  return { x: IMPACT.x + (p.x - IMPACT.x) * t, y: IMPACT.y + (p.y - IMPACT.y) * t }
})

const pt = (p: { x: number; y: number }) => `${p.x.toFixed(1)}% ${p.y.toFixed(1)}%`

interface Shard {
  clip: string
  style: CSSProperties
}

/** Sixteen shards: an inner and an outer piece between each pair of radial cracks. */
const SHARDS: Shard[] = RIM.flatMap((rim, i) => {
  const next = RIM[(i + 1) % RIM.length]!
  const ringA = RING[i]!
  const ringB = RING[(i + 1) % RING.length]!
  const inner = [IMPACT, ringA, ringB]
  const outer = [ringA, rim, ...(rim.corner ? [rim.corner] : []), next, ringB]
  // Each piece leaves along its own direction from the impact, then gravity takes it.
  const mid = { x: (rim.x + next.x) / 2 - IMPACT.x, y: (rim.y + next.y) / 2 - IMPACT.y }
  const len = Math.hypot(mid.x, mid.y) || 1
  const dir = { x: mid.x / len, y: mid.y / len }
  const piece = (poly: typeof inner, reach: number, k: number): Shard => ({
    clip: `polygon(${poly.map(pt).join(', ')})`,
    style: {
      '--dx': `${(dir.x * reach).toFixed(0)}%`,
      '--dy': `${(70 + dir.y * reach * 0.6).toFixed(0)}%`,
      '--rot': `${(i % 2 ? 1 : -1) * (24 + ((i * 37 + k * 19) % 50))}deg`,
      '--d': `${(((i * 7 + k * 3) % 6) * 0.06).toFixed(2)}s`,
    } as CSSProperties,
  })
  return [piece(inner, 18, 0), piece(outer, 46, 1)]
})

/** Radial cracks first, out from the impact; then the ring that frees the pieces. */
const CRACKS: Array<{ d: string; delay: number }> = [
  ...RIM.map((p, i) => ({
    d: `M${IMPACT.x} ${IMPACT.y} L${p.x} ${p.y}`,
    delay: (i % 4) * 0.09,
  })),
  {
    d: `M${RING.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L')} Z`,
    delay: 0.45,
  },
]

/** A tiny seeded generator, so particles scatter the same way every time. */
function scatter(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

function particles(
  count: number,
  seed: number,
  make: (r: () => number, i: number) => CSSProperties,
) {
  const r = scatter(seed)
  return Array.from({ length: count }, (_, i) => make(r, i))
}

const ASH = particles(
  16,
  7,
  (r) =>
    ({
      left: `${(15 + r() * 70).toFixed(0)}%`,
      top: `${(-5 + r() * 45).toFixed(0)}%`,
      '--drift': `${((r() - 0.5) * 40).toFixed(0)}%`,
      '--d': `${(r() * 5).toFixed(2)}s`,
      '--s': `${(2 + r() * 3).toFixed(1)}px`,
    }) as CSSProperties,
)

const DUST = particles(
  12,
  11,
  (r) =>
    ({
      left: `${(30 + r() * 40).toFixed(0)}%`,
      '--dx': `${((r() - 0.5) * 220).toFixed(0)}%`,
      '--dy': `${(-4 - r() * 18).toFixed(0)}%`,
      '--d': `${(r() * 0.3).toFixed(2)}s`,
    }) as CSSProperties,
)

const DIRT = particles(14, 23, (r, i) => {
  const side = i % 2 ? 1 : -1
  return {
    left: `${(42 + r() * 16).toFixed(0)}%`,
    '--dx': `${(side * (40 + r() * 90)).toFixed(0)}%`,
    '--up': `${(-40 - r() * 70).toFixed(0)}%`,
    '--rot': `${(side * (90 + r() * 360)).toFixed(0)}deg`,
    '--d': `${(r() * 1.4).toFixed(2)}s`,
  } as CSSProperties
})

const ORDINAL = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

/** The film's captions, told from the player's own record. */
function captions(name: string, standing: PlayerStanding): string[] {
  const fatal = standing.history.find((h) => h.eliminatedHere)
  if (!fatal) return []
  const team = fatal.pick ? getTeam(fatal.pick.teamId) : null
  const blow = !fatal.pick
    ? 'No pick came in.'
    : `The ${team?.name ?? fatal.pick.teamId} ${fatal.outcome === 'tie' ? 'tied' : 'lost'}.`
  const strike =
    standing.livesTotal === 1
      ? 'One strike.'
      : `Strike ${ORDINAL[standing.livesTotal] ?? standing.livesTotal}.`
  return [`Week ${fatal.week}.`, blow, strike, `Rest in peace, ${name.split(' ')[0]}.`]
}

export interface FuneralProps {
  name: string
  playerId: string
  standing: PlayerStanding
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero'
  playing: boolean
  /** The stone, already engraved; the scene raises it out of the ground. */
  children: ReactNode
}

export function Funeral({ name, playerId, standing, size, playing, children }: FuneralProps) {
  const face = <Headshot name={name} playerId={playerId} size={size} status="eliminated" />
  const anchor = useRef<HTMLDivElement>(null)
  const lines = captions(name, standing)
  return (
    <div ref={anchor} className={playing ? 'funeral is-playing' : 'funeral'}>
      <HouseLights playing={playing} anchor={anchor} />
      <div aria-hidden="true" className="funeral-beam" />
      <div aria-hidden="true" className="funeral-ash">
        {ASH.map((style, i) => (
          <span key={i} style={style} />
        ))}
      </div>
      <div className="funeral-quake">
        <div className="funeral-plot">{children}</div>
        <div aria-hidden="true" className="funeral-mound" />
        <div aria-hidden="true" className="funeral-dirt">
          {DIRT.map((style, i) => (
            <span key={i} style={style} />
          ))}
        </div>
        <div aria-hidden="true" className="funeral-face">
          <div className="funeral-pulse">
            {/* One whole face until the blow lands; the shards only exist from then on,
                so their seams never show on an intact photo. */}
            <div className="funeral-whole">{face}</div>
            <div className="funeral-shards">
              {SHARDS.map((s, i) => (
                <div key={i} className="funeral-shard" style={{ ...s.style, clipPath: s.clip }}>
                  {face}
                </div>
              ))}
            </div>
            <svg className="funeral-cracks" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <clipPath id={`funeral-round-${playerId}`}>
                  <circle cx="50" cy="50" r="50" />
                </clipPath>
              </defs>
              <g clipPath={`url(#funeral-round-${playerId})`}>
                {CRACKS.map((c, i) => (
                  <g key={i} style={{ '--d': `${c.delay}s` } as CSSProperties}>
                    <path className="funeral-crack-shadow" d={c.d} pathLength={1} />
                    <path className="funeral-crack" d={c.d} pathLength={1} />
                  </g>
                ))}
              </g>
            </svg>
            <div className="funeral-flash" />
          </div>
        </div>
        <div aria-hidden="true" className="funeral-dust">
          {DUST.map((style, i) => (
            <span key={i} style={style} />
          ))}
        </div>
        <div aria-hidden="true" className="funeral-ghost">
          <div className="funeral-ghost-body">
            <svg className="funeral-sheet" viewBox="0 0 100 130" preserveAspectRatio="none">
              <defs>
                <linearGradient id={`funeral-sheet-${playerId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#eef3ff" stopOpacity="0.62" />
                  <stop offset="0.55" stopColor="#d6dfff" stopOpacity="0.42" />
                  <stop offset="1" stopColor="#c9d4ff" stopOpacity="0.04" />
                </linearGradient>
              </defs>
              <path
                d="M50 4 C27 4 15 24 15 50 L15 108 Q22.5 122 30 108 Q37.5 122 45 108 Q52.5 122 60 108 Q67.5 122 75 108 Q82.5 122 85 108 L85 50 C85 24 73 4 50 4 Z"
                fill={`url(#funeral-sheet-${playerId})`}
              />
            </svg>
            <div className="funeral-ghost-face">{face}</div>
          </div>
        </div>
      </div>
      <div aria-hidden="true" className="funeral-captions">
        {lines.map((line, i) => (
          <p key={line} className={`funeral-caption funeral-caption-${i}`}>
            {line}
          </p>
        ))}
      </div>
    </div>
  )
}

/**
 * The house lights. A page-wide dim with a soft hole over the grave, rendered
 * through a portal so no card edge can frame it; it follows the stone if the
 * viewer scrolls. Reduced-motion viewers never reach the funeral at all.
 */
function HouseLights({
  playing,
  anchor,
}: {
  playing: boolean
  anchor: React.RefObject<HTMLDivElement | null>
}) {
  const [spot, setSpot] = useState<{ x: number; y: number; r: number } | null>(null)
  useEffect(() => {
    if (!playing || typeof document === 'undefined') return
    let frame = 0
    const measure = () => {
      frame = 0
      const el = anchor.current
      if (!el) return
      const b = el.getBoundingClientRect()
      setSpot({ x: b.left + b.width / 2, y: b.top + b.height / 2, r: Math.max(b.width, b.height) })
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [playing, anchor])
  if (!playing || !spot) return null
  return createPortal(
    <div
      aria-hidden="true"
      className="funeral-house-lights"
      style={{ '--x': `${spot.x}px`, '--y': `${spot.y}px`, '--r': `${spot.r}px` } as CSSProperties}
    />,
    document.body,
  )
}
