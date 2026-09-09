import type { GameResultUpdate, NFLGame, NFLWeek } from '@domain/index'

/**
 * An external NFL data source. Implementations live server-side only so any
 * API key stays out of the browser bundle. `fetchWeek` returns the schedule
 * (with results where final) for one week; the sync job turns that into
 * idempotent GameResultUpdates via the domain's applyGameResults().
 */
export interface ExternalNFLProvider {
  readonly name: string
  fetchWeek(seasonYear: number, week: number): Promise<{ games: NFLGame[]; week: NFLWeek }>
}

export function toResultUpdates(games: NFLGame[], observedAt: string): GameResultUpdate[] {
  return games.map((g) => ({
    gameId: g.id,
    status: g.status,
    homeScore: g.homeScore,
    awayScore: g.awayScore,
    winnerTeamId: g.status === 'final' ? (g.winnerTeamId ?? undefined) : undefined,
    kickoffAt: g.kickoffAt,
    source: 'provider',
    observedAt,
  }))
}
