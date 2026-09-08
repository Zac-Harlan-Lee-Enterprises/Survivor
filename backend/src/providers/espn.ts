import {
  ALL_TEAM_IDS,
  lookupTeam,
  type GameStatus,
  type NFLGame,
  type NFLWeek,
} from '@domain/index'
import { gameIdFor, type ExternalNFLProvider } from './types'

/**
 * ESPN public scoreboard feed (no API key).
 *
 * This endpoint is UNOFFICIAL and may change without notice; treat it as a
 * best-effort convenience. The commissioner's manual-result fallback keeps the
 * league running if it disappears, and a licensed provider can be dropped in
 * by implementing ExternalNFLProvider (its key read from SSM, never VITE_*).
 *
 * The parser is pure (parseScoreboard) so it is unit-tested against a fixture.
 */
const ENDPOINT = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'

interface EspnCompetitor {
  homeAway?: string
  score?: string | number
  winner?: boolean
  team?: { abbreviation?: string; displayName?: string }
}
interface EspnEvent {
  id?: string
  date?: string
  status?: { type?: { name?: string; completed?: boolean } }
  competitions?: Array<{ competitors?: EspnCompetitor[]; date?: string }>
}
export interface EspnScoreboard {
  events?: EspnEvent[]
}

function mapStatus(name: string | undefined): GameStatus {
  switch (name) {
    case 'STATUS_FINAL':
    case 'STATUS_FINAL_OT':
      return 'final'
    case 'STATUS_IN_PROGRESS':
    case 'STATUS_HALFTIME':
    case 'STATUS_END_PERIOD':
    case 'STATUS_DELAYED':
      return 'in_progress'
    case 'STATUS_POSTPONED':
    case 'STATUS_SUSPENDED':
      return 'postponed'
    case 'STATUS_CANCELED':
    case 'STATUS_FORFEIT':
      return 'cancelled'
    default:
      return 'scheduled'
  }
}

function teamIdOf(c: EspnCompetitor | undefined): string | null {
  const raw = c?.team?.abbreviation ?? c?.team?.displayName ?? ''
  const hit = lookupTeam(raw)
  return hit.kind === 'match' ? hit.teamId : null
}

export function parseScoreboard(
  data: EspnScoreboard,
  seasonYear: number,
  week: number,
  observedAt: string,
): { games: NFLGame[]; week: NFLWeek } {
  const games: NFLGame[] = []
  for (const ev of data.events ?? []) {
    const comp = ev.competitions?.[0]
    const home = comp?.competitors?.find((c) => c.homeAway === 'home')
    const away = comp?.competitors?.find((c) => c.homeAway === 'away')
    const homeId = teamIdOf(home)
    const awayId = teamIdOf(away)
    const kickoff = comp?.date ?? ev.date
    if (!homeId || !awayId || !kickoff) continue // unknown team or missing date: skip, never guess
    const status = mapStatus(ev.status?.type?.name)
    const homeScore =
      home?.score !== undefined && home.score !== '' ? Number(home.score) : undefined
    const awayScore =
      away?.score !== undefined && away.score !== '' ? Number(away.score) : undefined
    const game: NFLGame = {
      id: gameIdFor(seasonYear, week, awayId, homeId),
      seasonYear,
      week,
      homeTeamId: homeId,
      awayTeamId: awayId,
      kickoffAt: new Date(kickoff).toISOString(),
      status,
      homeScore: status === 'final' || status === 'in_progress' ? homeScore : undefined,
      awayScore: status === 'final' || status === 'in_progress' ? awayScore : undefined,
      winnerTeamId:
        status === 'final' && homeScore !== undefined && awayScore !== undefined
          ? homeScore > awayScore
            ? homeId
            : awayScore > homeScore
              ? awayId
              : null
          : undefined,
      resultVersion: 0,
      updatedAt: observedAt,
    }
    games.push(game)
  }
  const playing = new Set(games.flatMap((g) => [g.homeTeamId, g.awayTeamId]))
  return {
    games,
    week: {
      seasonYear,
      week,
      label: `Week ${week}`,
      byeTeamIds: ALL_TEAM_IDS.filter((t) => !playing.has(t)),
    },
  }
}

export function createEspnProvider(
  fetchImpl: typeof fetch = fetch,
  now: () => Date = () => new Date(),
): ExternalNFLProvider {
  return {
    name: 'espn-public-scoreboard',
    async fetchWeek(seasonYear, week) {
      const url = `${ENDPOINT}?dates=${seasonYear}&seasontype=2&week=${week}`
      const res = await fetchImpl(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(`ESPN scoreboard responded ${res.status}`)
      const data = (await res.json()) as EspnScoreboard
      return parseScoreboard(data, seasonYear, week, now().toISOString())
    },
  }
}
