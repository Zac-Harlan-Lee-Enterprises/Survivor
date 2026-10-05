import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { LeagueContext } from '@/app/hooks'
import { getTeam, type PlayerStanding } from '@/domain'
import { EPITAPHS } from '@/lib/epitaphs'
import { FAN_OF } from '@/lib/fans'
import { cn } from '@/lib/cn'
import { Headshot } from './Headshot'
import { TeamMonogram } from './TeamMonogram'
import { funeralSoundEnabled, playFuneralScore } from './funeralSound'

/**
 * The funeral: a short film played over a fresh grave.
 *
 *   house lights down, letterbox in, a beam falls, ash and rain  0.0s
 *   "Week 3."  "The 49ers lost."                                 0.6–7.2s
 *   colour drains over a slowing heartbeat                       0.3–6.0s
 *   cracks spread from the point of impact                       6.2–7.3s
 *   "Strike three." — lightning, the face shatters               7.1–10.5s
 *   the morning paper lands                                      7.8–12.2s
 *   "A Bears fan. Slain by the Bears."  (when it applies)        10.4–13.8s
 *   dust; the earth heaps; the mourners gather                   10.5–12.5s
 *   the stone grinds up out of the ground                        11.2–13.8s
 *   "Dave, Don and Maya took the same hit."                      12.6–16.6s
 *   the epitaph is chiselled, line by line                       14–16.7s
 *   the ghost rises                                              15.2–20.7s
 *   "Survived by 23 league members who made better decisions."   16.8–21.4s
 *   a glint crosses the stone; "Killed by ARI 30–27" lands       18.2s, 18.8s
 *   credits                                                      21.2–26.8s
 *   lights up, letterbox out; the crow flies in and stays        24.6s, 25.4s
 *
 * All motion is CSS (index.css, `.funeral.is-playing …`) driven by one class
 * toggle, so the browser composites it and nothing re-renders mid-scene. The
 * whole scene is aria-hidden: the stone it reveals carries the meaning. The
 * script is written from the player's own record and, where the league is in
 * context, from everyone else's.
 */
export const FUNERAL_MS = 27_500

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

/** FNV-1a, so each player's break is their own and never changes. */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
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

const ORDINAL = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

const firstName = (name: string) => name.split(' ')[0]!

/** "Dave, Don and Maya" */
function list(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

interface Caption {
  text: string
  at: number
  dur: number
  hit?: boolean
}

/** Someone else at the graveside. */
interface Mourner {
  playerId: string
  name: string
  /** Lost a life on the same team the same week: stands closest, head bowed. */
  close: boolean
}

/**
 * Everything the script needs, read once from the player's record and — when
 * the league is in context — everyone else's. In a component test with no
 * league, the scene simply has fewer lines and no mourners.
 */
function useScript(name: string, playerId: string, standing: PlayerStanding) {
  const league = useContext(LeagueContext)
  return useMemo(() => {
    const fatal = standing.history.find((h) => h.eliminatedHere)
    if (!fatal) {
      return {
        captions: [] as Caption[],
        mourners: [] as Mourner[],
        weapon: null,
        paper: null,
        credits: null,
      }
    }
    const first = firstName(name)
    const team = fatal.pick ? getTeam(fatal.pick.teamId) : null
    const game = fatal.game
    const winnerId = game?.winnerTeamId ?? null
    const winner = winnerId ? getTeam(winnerId) : null
    const home = !!(fatal.pick && game && game.homeTeamId === fatal.pick.teamId)
    const score = (() => {
      if (!game || !fatal.pick || game.homeScore === undefined || game.awayScore === undefined)
        return null
      const mine = fatal.pick.teamId === game.homeTeamId ? game.homeScore : game.awayScore
      const theirs = fatal.pick.teamId === game.homeTeamId ? game.awayScore : game.homeScore
      return { mine, theirs }
    })()

    const captions: Caption[] = [
      { text: `Week ${fatal.week}.`, at: 0.6, dur: 3.2 },
      {
        text: !fatal.pick
          ? 'No pick came in.'
          : `The ${team?.name ?? fatal.pick.teamId} ${fatal.outcome === 'tie' ? 'tied' : 'lost'}.`,
        at: 3.6,
        dur: 3.6,
      },
      {
        text:
          standing.livesTotal === 1
            ? 'One strike.'
            : `Strike ${ORDINAL[standing.livesTotal] ?? standing.livesTotal}.`,
        at: 7.1,
        dur: 3.4,
        hit: true,
      },
    ]

    // "A Bears fan. Slain by the Bears." — only when the record says so.
    const fan = FAN_OF[playerId] ? getTeam(FAN_OF[playerId]!) : null
    if (fan && winnerId === fan.id) {
      captions.push({ text: `A ${fan.name} fan. Slain by the ${fan.name}.`, at: 10.4, dur: 3.4 })
    }

    // Who else took the same hit, and who is left.
    const standings = league?.evaluation?.standings ?? []
    const nameOf = (id: string) => league?.profileOf(id).displayName ?? id
    const close = standings.filter(
      (s) =>
        s.playerId !== playerId &&
        s.history.some(
          (h) =>
            h.week === fatal.week &&
            h.consumedLife &&
            !!h.pick &&
            !!fatal.pick &&
            h.pick.teamId === fatal.pick.teamId,
        ),
    )
    if (fatal.pick && league?.evaluation) {
      captions.push({
        text: close.length
          ? `${list(close.map((s) => firstName(nameOf(s.playerId))))} took the same hit.`
          : `Nobody else took that hit.`,
        at: 12.6,
        dur: 4.0,
      })
    }
    const living = standings.filter((s) => s.status === 'alive' && s.playerId !== playerId)
    if (league?.evaluation) {
      captions.push({
        text: `Survived by ${living.length} league member${living.length === 1 ? '' : 's'} who made better decisions.`,
        at: 16.8,
        dur: 4.6,
      })
    }

    const mourners: Mourner[] = [
      ...close.map((s) => ({ playerId: s.playerId, name: nameOf(s.playerId), close: true })),
      ...living
        .filter((s) => !close.includes(s))
        .map((s) => ({ playerId: s.playerId, name: nameOf(s.playerId), close: false })),
    ].slice(0, 10)

    const weapon =
      winner && score && fatal.outcome === 'loss'
        ? {
            teamId: winner.id,
            score: `Killed by ${winner.abbreviation} ${score.theirs}–${score.mine}`,
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

    const teams = standing.history
      .filter((h) => h.pick && h.week <= fatal.week)
      .map((h) => getTeam(h.pick!.teamId)?.name ?? h.pick!.teamId)
    const recap = EPITAPHS[playerId]?.recap
    const quote = recap
      ? (recap
          .split(/(?<=[.!?])\s+/)
          .filter(Boolean)
          .at(-1) ?? `Rest in peace, ${first}.`)
      : `Rest in peace, ${first}.`
    const credits = {
      name,
      span: fatal.week === 1 ? 'Week 1' : `Weeks 1–${fatal.week}`,
      teams: teams.join(' · '),
      quote,
    }

    return { captions, mourners, weapon, paper, credits }
  }, [league, name, playerId, standing])
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
  const { shards, cracks } = useMemo(() => geometry(playerId), [playerId])
  const { captions, mourners, weapon, paper, credits } = useScript(name, playerId, standing)

  // The score, if the viewer asked for it; it stops with the scene.
  useEffect(() => {
    if (!playing || !funeralSoundEnabled()) return
    return playFuneralScore()
  }, [playing])

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
        <div aria-hidden="true" className="funeral-mourners">
          {mourners.map((m, i) => {
            const side = i % 2 ? 1 : -1
            const k = Math.floor(i / 2)
            const perSide = Math.ceil(mourners.length / 2)
            // A crowd packs in: the whole row has to fit beside the stone.
            const step = perSide > 1 ? Math.min(14, 30 / (perSide - 1)) : 0
            const x = side * (m.close ? 50 : 56) * 1 + side * k * step
            return (
              <div
                key={m.playerId}
                className={cn('funeral-mourner', m.close && 'is-close')}
                style={
                  {
                    '--side': side,
                    '--x': `${x.toFixed(1)}%`,
                    '--d': `${(i * 0.14).toFixed(2)}s`,
                    zIndex: 10 - k,
                  } as CSSProperties
                }
              >
                <Headshot
                  name={m.name}
                  playerId={m.playerId}
                  size="xs"
                  status={m.close ? 'eliminated' : 'alive'}
                />
              </div>
            )
          })}
        </div>
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
      <div aria-hidden="true" className="funeral-captions">
        {captions.map((c) => (
          <p
            key={c.text}
            className={cn('funeral-caption', c.hit && 'is-hit')}
            style={{ '--at': `${c.at}s`, '--dur': `${c.dur}s` } as CSSProperties}
          >
            {c.text}
          </p>
        ))}
        {credits && (
          <div className="funeral-credits">
            <p className="funeral-credits-name">{credits.name}</p>
            <p className="funeral-credits-span">{credits.span}</p>
            <p className="funeral-credits-teams">{credits.teams}</p>
            <p className="funeral-credits-quote">“{credits.quote}”</p>
          </div>
        )}
      </div>
    </div>
  )
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
    <div aria-hidden="true" className="funeral-house">
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
