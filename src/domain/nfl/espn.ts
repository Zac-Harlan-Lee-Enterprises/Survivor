import { ALL_TEAM_IDS, lookupTeam } from '../teams'
import type { GameStatus, NFLGame, NFLWeek } from '../models'

/**
 * Pure parser for ESPN's public NFL scoreboard payload.
 *
 * Lives in the domain because BOTH the browser (static/demo mode, which calls
 * ESPN directly — the endpoint sends `access-control-allow-origin: *`) and the
 * Lambda results-sync use it. It performs no I/O, so it is fully unit-testable
 * against captured payloads.
 *
 * The endpoint is UNOFFICIAL and may change without notice. Anything this
 * parser cannot understand is skipped rather than guessed, and the commissioner
 * can always enter results by hand.
 */

export const ESPN_SCOREBOARD_URL =
  'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'

/** Query for one specific regular-season week. */
export function espnWeekUrl(seasonYear: number, week: number): string {
  return `${ESPN_SCOREBOARD_URL}?dates=${seasonYear}&seasontype=2&week=${week}`
}

interface EspnCompetitor {
  homeAway?: string
  score?: string | number
  /** Real payloads send null before a game is decided, not just true/false. */
  winner?: boolean | null
  team?: { abbreviation?: string; displayName?: string }
}
/** ESPN reports where a game is up to: "3rd 5:21", "Halftime", "End of 2nd". */
interface EspnStatus {
  displayClock?: string
  period?: number
  type?: { name?: string; shortDetail?: string }
}
/** The odds block. Only `details` is read ("DAL -9.5", "EVEN"); the rest is sportsbook detail. */
interface EspnOdds {
  details?: string
}
interface EspnCompetition {
  date?: string
  competitors?: EspnCompetitor[]
  status?: EspnStatus
  odds?: EspnOdds[]
}
interface EspnEvent {
  id?: string
  date?: string
  status?: EspnStatus
  competitions?: EspnCompetition[]
}
export interface EspnScoreboard {
  season?: { year?: number; type?: number }
  week?: { number?: number }
  events?: EspnEvent[]
}

/** Maps ESPN's status vocabulary onto the domain's. */
export function mapEspnStatus(name: string | undefined): GameStatus {
  switch (name) {
    case 'STATUS_FINAL':
    case 'STATUS_FINAL_OT':
    case 'STATUS_FINAL_PEN':
      return 'final'
    case 'STATUS_IN_PROGRESS':
    case 'STATUS_HALFTIME':
    case 'STATUS_END_PERIOD':
    case 'STATUS_END_OF_PERIOD':
    case 'STATUS_DELAYED':
    case 'STATUS_RAIN_DELAY':
      return 'in_progress'
    case 'STATUS_POSTPONED':
    case 'STATUS_SUSPENDED':
      return 'postponed'
    case 'STATUS_CANCELED':
    case 'STATUS_CANCELLED':
    case 'STATUS_FORFEIT':
      return 'cancelled'
    default:
      return 'scheduled'
  }
}

/** Deterministic, provider-independent id so switching providers never orphans a pick. */
export function gameIdFor(
  seasonYear: number,
  week: number,
  awayTeamId: string,
  homeTeamId: string,
): string {
  return `${seasonYear}-w${String(week).padStart(2, '0')}-${awayTeamId}-at-${homeTeamId}`
}

function teamIdOf(c: EspnCompetitor | undefined): string | null {
  const hit = lookupTeam(c?.team?.abbreviation ?? c?.team?.displayName ?? '')
  return hit.kind === 'match' ? hit.teamId : null
}

function toScore(raw: string | number | undefined): number | undefined {
  if (raw === undefined || raw === '') return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

/** Longest live label the tiles will show; anything odder is dropped. */
const MAX_DETAIL = 24

/**
 * Where an in-progress game is up to, as short display text.
 *
 * ESPN's own `shortDetail` ("3rd 5:21", "Halftime") is preferred because it is
 * built for exactly this and already handles overtime and period ends. Period
 * and clock are the fallback when it is missing.
 *
 * Deliberately empty for every other status: a scheduled game shows its kickoff
 * in the league's timezone, and a final one already says who won.
 */
export function liveDetailFor(status: GameStatus, espn: EspnStatus | undefined): string | null {
  if (status !== 'in_progress') return null
  const short = espn?.type?.shortDetail?.trim()
  if (short && short.length <= MAX_DETAIL) return short
  const clock = espn?.displayClock?.trim()
  const period = espn?.period
  if (period && clock) return `Q${period} ${clock}`
  if (period) return `Q${period}`
  return null
}

export interface ParsedScoreboard {
  seasonYear: number
  week: NFLWeek
  games: NFLGame[]
  /** Events that could not be understood (unknown team, missing date). */
  skipped: number
  /**
   * Game id → where it is up to right now ("3rd 5:21").
   *
   * EPHEMERAL, and deliberately not part of NFLGame: this changes every few
   * seconds, so persisting it would either bump resultVersion on every tick or
   * go stale between syncs. It is display detail from this observation only.
   */
  liveDetail: Record<string, string>
  /**
   * Game id → the point spread, where the feed has one. EPHEMERAL like
   * liveDetail: a line moves all week, so it is read fresh, never stored.
   */
  lines: Record<string, GameLine>
}

/**
 * The point spread for one game: who is favoured, and by how much. Shown on
 * the slate as a data point for picking — the market's view of who should win
 * — and nothing more: no sportsbook, no prices, no links.
 */
export interface GameLine {
  /** The favoured team, or null for a pick'em. */
  favoriteTeamId: string | null
  /** Points the favourite is laying; 0 for a pick'em. */
  points: number
}

/**
 * Reads ESPN's line summary ("DAL -9.5", "WSH -3.5", "EVEN", "PK") for a game
 * between these two teams. Anything it cannot read, or a favourite who is not
 * in the game, is no line at all rather than a wrong one.
 */
export function parseLine(
  details: string | undefined,
  homeTeamId: string,
  awayTeamId: string,
): GameLine | null {
  const text = details?.trim()
  if (!text) return null
  if (/^(even|pk|pick'?em|pick)$/i.test(text)) return { favoriteTeamId: null, points: 0 }
  const m = /^([A-Za-z]{2,4})\s*([-+]?\d+(?:\.\d+)?)$/.exec(text)
  if (!m) return null
  const hit = lookupTeam(m[1]!)
  if (hit.kind !== 'match') return null
  if (hit.teamId !== homeTeamId && hit.teamId !== awayTeamId) return null
  const points = Math.abs(Number(m[2]))
  if (!Number.isFinite(points)) return null
  return points === 0 ? { favoriteTeamId: null, points: 0 } : { favoriteTeamId: hit.teamId, points }
}

export function parseScoreboard(
  data: EspnScoreboard,
  observedAt: string,
  fallback?: { seasonYear?: number; week?: number },
): ParsedScoreboard {
  const seasonYear = data.season?.year ?? fallback?.seasonYear
  const weekNumber = data.week?.number ?? fallback?.week
  if (!seasonYear || !weekNumber) {
    throw new Error('ESPN payload did not identify a season year and week')
  }

  const games: NFLGame[] = []
  const liveDetail: Record<string, string> = {}
  const lines: Record<string, GameLine> = {}
  let skipped = 0
  for (const ev of data.events ?? []) {
    const comp = ev.competitions?.[0]
    const home = comp?.competitors?.find((c) => c.homeAway === 'home')
    const away = comp?.competitors?.find((c) => c.homeAway === 'away')
    const homeTeamId = teamIdOf(home)
    const awayTeamId = teamIdOf(away)
    const kickoff = comp?.date ?? ev.date
    if (!homeTeamId || !awayTeamId || !kickoff || homeTeamId === awayTeamId) {
      skipped += 1
      continue
    }
    const status = mapEspnStatus(comp?.status?.type?.name ?? ev.status?.type?.name)
    const live = status === 'final' || status === 'in_progress'
    const homeScore = live ? toScore(home?.score) : undefined
    const awayScore = live ? toScore(away?.score) : undefined
    let winnerTeamId: string | null | undefined
    if (status === 'final') {
      if (homeScore !== undefined && awayScore !== undefined) {
        winnerTeamId =
          homeScore > awayScore ? homeTeamId : awayScore > homeScore ? awayTeamId : null
      } else if (home?.winner === true) winnerTeamId = homeTeamId
      else if (away?.winner === true) winnerTeamId = awayTeamId
      else {
        // Final with nothing to decide a winner: leave it unresolved rather
        // than inventing one. The commissioner can enter it by hand.
        skipped += 1
        continue
      }
    }
    const id = gameIdFor(seasonYear, weekNumber, awayTeamId, homeTeamId)
    const detail = liveDetailFor(status, comp?.status ?? ev.status)
    if (detail) liveDetail[id] = detail
    const line = parseLine(comp?.odds?.[0]?.details, homeTeamId, awayTeamId)
    if (line) lines[id] = line
    games.push({
      id,
      seasonYear,
      week: weekNumber,
      homeTeamId,
      awayTeamId,
      kickoffAt: new Date(kickoff).toISOString(),
      status,
      homeScore,
      awayScore,
      winnerTeamId,
      resultVersion: 0,
      resultSource: 'provider',
      updatedAt: observedAt,
    })
  }

  const playing = new Set(games.flatMap((g) => [g.homeTeamId, g.awayTeamId]))
  return {
    seasonYear,
    week: {
      seasonYear,
      week: weekNumber,
      label: `Week ${weekNumber}`,
      byeTeamIds: ALL_TEAM_IDS.filter((t) => !playing.has(t)),
      source: 'provider',
    },
    games,
    skipped,
    liveDetail,
    lines,
  }
}
