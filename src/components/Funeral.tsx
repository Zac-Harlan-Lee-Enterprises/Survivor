import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { getTeam, type PlayerStanding } from '@/domain'
import { Headshot } from './Headshot'
import { hash } from './graveVariant'
import { TeamMonogram } from './TeamMonogram'

/**
 * The funeral: a short film played over a fresh grave.
 *
 *   house lights down, letterbox in, a beam falls, ash and rain  0.0s
 *   colour drains over a slowing heartbeat                       0.3–4.8s
 *   cracks spread from the point of impact                       4.4–5.5s
 *   lightning; the face shatters                                 5.4s
 *   the morning paper lands                                      5.9–9.9s
 *   dust; the earth heaps; the stone grinds up                   8–11s
 *   the epitaph is chiselled, line by line                       11.2–13.9s
 *   the ghost rises                                              12–17.5s
 *   a glint crosses the stone; "Finally done in by ARI 30–27" lands       14.4s, 15s
 *   lights up, letterbox out; the crow flies in and stays        17.8s, 18.6s
 *
 * All motion is CSS (index.css, `.funeral.is-playing …`) driven by one class
 * toggle, so the browser composites it and nothing re-renders mid-scene. The
 * whole scene is aria-hidden: the stone it reveals carries the meaning.
 */
export const FUNERAL_MS = 21_000

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

const pt = (p: { x: number; y: number }) => `${p.x.toFixed(1)}% ${p.y.toFixed(1)}%`

/** A tiny seeded generator, so a scene plays the same way every time. */
function scatter(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

interface Shard {
  clip: string
  style: CSSProperties
}

/**
 * How this particular face breaks: where the blow lands, where the ring crack
 * runs, and the sixteen pieces between. Seeded by player, so Nate's shatter
 * never looks like Joey's.
 */
function geometry(seed: string) {
  const r = scatter(hash(seed))
  const impact = { x: 36 + r() * 28, y: 30 + r() * 22 }
  const ring = RIM.map((p) => {
    const t = 0.36 + r() * 0.2
    return { x: impact.x + (p.x - impact.x) * t, y: impact.y + (p.y - impact.y) * t }
  })
  const shards: Shard[] = RIM.flatMap((rim, i) => {
    const next = RIM[(i + 1) % RIM.length]!
    const ringA = ring[i]!
    const ringB = ring[(i + 1) % ring.length]!
    const inner = [impact, ringA, ringB]
    const outer = [ringA, rim, ...(rim.corner ? [rim.corner] : []), next, ringB]
    // Each piece leaves along its own direction from the impact, then gravity takes it.
    const mid = { x: (rim.x + next.x) / 2 - impact.x, y: (rim.y + next.y) / 2 - impact.y }
    const len = Math.hypot(mid.x, mid.y) || 1
    const dir = { x: mid.x / len, y: mid.y / len }
    const piece = (poly: typeof inner, reach: number): Shard => ({
      clip: `polygon(${poly.map(pt).join(', ')})`,
      style: {
        '--dx': `${(dir.x * reach).toFixed(0)}%`,
        '--dy': `${(70 + dir.y * reach * 0.6).toFixed(0)}%`,
        '--rot': `${(i % 2 ? 1 : -1) * (24 + Math.round(r() * 50))}deg`,
        '--d': `${(r() * 0.3).toFixed(2)}s`,
      } as CSSProperties,
    })
    return [piece(inner, 18), piece(outer, 46)]
  })
  const cracks: Array<{ d: string; delay: number }> = [
    ...RIM.map((p, i) => ({
      d: `M${impact.x.toFixed(1)} ${impact.y.toFixed(1)} L${p.x} ${p.y}`,
      delay: (i % 4) * 0.09,
    })),
    {
      d: `M${ring.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L')} Z`,
      delay: 0.45,
    },
  ]
  return { shards, cracks }
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

const RAIN = particles(
  38,
  3,
  (r) =>
    ({
      left: `${(-10 + r() * 120).toFixed(0)}%`,
      '--d': `${(r() * 0.9).toFixed(2)}s`,
      '--dur': `${(0.55 + r() * 0.3).toFixed(2)}s`,
      '--len': `${(10 + r() * 14).toFixed(0)}px`,
      '--o': `${(0.25 + r() * 0.45).toFixed(2)}`,
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

/**
 * What the scene needs from the player's record: the weapon that finished
 * them and the morning paper's headline.
 */
function useScript(name: string, standing: PlayerStanding) {
  return useMemo(() => {
    const fatal = standing.history.find((h) => h.eliminatedHere)
    if (!fatal) return { weapon: null, paper: null }
    const team = fatal.pick ? getTeam(fatal.pick.teamId) : null
    const game = fatal.game
    const winner = game?.winnerTeamId ? getTeam(game.winnerTeamId) : null
    const home = !!(fatal.pick && game && game.homeTeamId === fatal.pick.teamId)
    const score = (() => {
      if (!game || !fatal.pick || game.homeScore === undefined || game.awayScore === undefined) {
        return null
      }
      const mine = fatal.pick.teamId === game.homeTeamId ? game.homeScore : game.awayScore
      const theirs = fatal.pick.teamId === game.homeTeamId ? game.awayScore : game.homeScore
      return { mine, theirs }
    })()

    const weapon =
      winner && score && fatal.outcome === 'loss'
        ? {
            teamId: winner.id,
            score: `Finally done in by ${winner.abbreviation} ${score.theirs}–${score.mine}`,
          }
        : null

    const headline = !fatal.pick
      ? `${name} forgets to pick, dies`
      : fatal.outcome === 'tie'
        ? `${name} ties, still dies`
        : `${name} trusts ${team?.name ?? fatal.pick.teamId} ${home ? 'at home' : 'on the road'}, dies`
    const paper = {
      headline,
      sub:
        score && team && winner
          ? `${winner.name} ${score.theirs}, ${team.name} ${score.mine}`
          : `Week ${fatal.week}`,
      week: fatal.week,
    }
    return { weapon, paper }
  }, [name, standing])
}

export interface FuneralProps {
  name: string
  playerId: string
  standing: PlayerStanding
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero'
  playing: boolean
  /** Which way the ghost drifts as it rises (see graveVariant). */
  sway?: 1 | -1
  /** The stone, already engraved; the scene raises it out of the ground. */
  children: ReactNode
}

export function Funeral({
  name,
  playerId,
  standing,
  size,
  playing,
  sway = 1,
  children,
}: FuneralProps) {
  const face = <Headshot name={name} playerId={playerId} size={size} status="eliminated" />
  const anchor = useRef<HTMLDivElement>(null)
  const { shards, cracks } = useMemo(() => geometry(playerId), [playerId])
  const { weapon, paper } = useScript(name, standing)

  return (
    <div
      ref={anchor}
      className={playing ? 'funeral is-playing' : 'funeral'}
      style={{ '--sway': sway } as CSSProperties}
    >
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
        {weapon && (
          <div aria-hidden="true" className="funeral-weapon" title={weapon.score}>
            <TeamMonogram teamId={weapon.teamId} size="sm" />
            <span className="funeral-score">{weapon.score}</span>
          </div>
        )}
        <div aria-hidden="true" className="funeral-face">
          <div className="funeral-pulse">
            {/* One whole face until the blow lands; the shards only exist from then on,
                so their seams never show on an intact photo. */}
            <div className="funeral-whole">{face}</div>
            <div className="funeral-shards">
              {shards.map((s, i) => (
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
                {cracks.map((c, i) => (
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
      <div aria-hidden="true" className="funeral-rain">
        {RAIN.map((style, i) => (
          <span key={i} style={style} />
        ))}
      </div>
      {paper && (
        <div aria-hidden="true" className="funeral-paper">
          <div className="funeral-paper-sheet">
            <p className="funeral-paper-mast">The Sunday Survivor</p>
            <p className="funeral-paper-meta">Week {paper.week} · Price: one life</p>
            <p className="funeral-paper-head">{paper.headline}</p>
            <p className="funeral-paper-sub">{paper.sub}</p>
            <div className="funeral-paper-cols">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Who holds the house lights. A row of fresh graves plays as a cascade, and
 * six dims stacked on one page turn it black; only the earliest funeral still
 * playing dims the house. When it ends, the next one takes the lights over
 * mid-scene, picking up its own timeline where it is, so the room never
 * flickers between them.
 */
const lightsQueue: string[] = []
const lightsListeners = new Set<() => void>()
const emitLights = () => lightsListeners.forEach((l) => l())
function useHoldsLights(playing: boolean): boolean {
  const id = useId()
  useEffect(() => {
    if (!playing) return
    lightsQueue.push(id)
    emitLights()
    return () => {
      const at = lightsQueue.indexOf(id)
      if (at >= 0) lightsQueue.splice(at, 1)
      emitLights()
    }
  }, [playing, id])
  const owner = useSyncExternalStore(
    (l) => {
      lightsListeners.add(l)
      return () => lightsListeners.delete(l)
    },
    () => lightsQueue[0] ?? null,
    () => null,
  )
  return playing && owner === id
}

/**
 * The house: a page-wide dim with a soft hole over the grave, the letterbox
 * bars, and the lightning — all rendered through a portal on the body so no
 * card edge can frame them. The hole follows the stone if the viewer scrolls.
 */
function HouseLights({
  playing,
  anchor,
}: {
  playing: boolean
  anchor: RefObject<HTMLDivElement | null>
}) {
  const holds = useHoldsLights(playing)
  // When this scene began, so a late handover picks the lights up mid-timeline.
  const startedAt = useRef(0)
  useEffect(() => {
    if (playing && !startedAt.current) startedAt.current = Date.now()
  }, [playing])
  const [spot, setSpot] = useState<{
    x: number
    y: number
    r: number
    elapsed: number
  } | null>(null)
  useEffect(() => {
    if (!holds || typeof document === 'undefined') return
    let frame = 0
    // How far into its own scene this funeral was when it took the lights:
    // fixed once, at the handover, so scrolling never moves the timeline.
    const elapsed = startedAt.current ? Math.max(0, Date.now() - startedAt.current) : 0
    const measure = () => {
      frame = 0
      const el = anchor.current
      if (!el) return
      const b = el.getBoundingClientRect()
      setSpot({
        x: b.left + b.width / 2,
        y: b.top + b.height / 2,
        r: Math.max(b.width, b.height),
        elapsed,
      })
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
  }, [holds, anchor])
  if (!holds || !spot) return null
  return createPortal(
    <div
      aria-hidden="true"
      className="funeral-house"
      style={{ '--elapsed': `${-spot.elapsed}ms` } as CSSProperties}
    >
      <div
        className="funeral-house-lights"
        style={
          { '--x': `${spot.x}px`, '--y': `${spot.y}px`, '--r': `${spot.r}px` } as CSSProperties
        }
      />
      <div className="funeral-bar funeral-bar-top" />
      <div className="funeral-bar funeral-bar-bottom" />
      <div className="funeral-lightning" />
    </div>,
    document.body,
  )
}
