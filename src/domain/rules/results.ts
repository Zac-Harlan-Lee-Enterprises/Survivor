import type { GameResultUpdate, GameStatus, NFLGame } from '../models'

/**
 * Idempotent result processing.
 *
 * Providers poll on a schedule and may deliver the same final several times;
 * two scheduler runs may overlap; the commissioner may correct a result after
 * the provider posted it. All of that must converge on the same stored game:
 *   - identical observations are no-ops (no version bump, no audit noise)
 *   - a commissioner result is locked against later provider updates
 *   - every accepted change bumps resultVersion exactly once
 */

export type SkipReason = 'identical' | 'commissioner-locked' | 'unknown-game'

export interface ApplyResultOutcome {
  game: NFLGame
  changed: boolean
  reason?: SkipReason
}

export class ResultConsistencyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ResultConsistencyError'
  }
}

export function deriveWinner(
  status: GameStatus,
  homeTeamId: string,
  awayTeamId: string,
  homeScore: number | undefined,
  awayScore: number | undefined,
  explicitWinner: string | null | undefined,
): string | null | undefined {
  if (status !== 'final') return undefined
  const fromScores =
    homeScore !== undefined && awayScore !== undefined
      ? homeScore > awayScore
        ? homeTeamId
        : awayScore > homeScore
          ? awayTeamId
          : null
      : undefined
  if (explicitWinner !== undefined) {
    if (explicitWinner !== null && explicitWinner !== homeTeamId && explicitWinner !== awayTeamId) {
      throw new ResultConsistencyError(`Winner ${explicitWinner} is not playing in this game`)
    }
    if (fromScores !== undefined && fromScores !== explicitWinner) {
      throw new ResultConsistencyError(
        `Winner ${String(explicitWinner)} contradicts score ${homeScore}-${awayScore}`,
      )
    }
    return explicitWinner
  }
  if (fromScores === undefined) {
    throw new ResultConsistencyError('A final result needs scores or an explicit winner')
  }
  return fromScores
}

function sameResult(a: NFLGame, b: NFLGame): boolean {
  return (
    a.status === b.status &&
    a.homeScore === b.homeScore &&
    a.awayScore === b.awayScore &&
    (a.winnerTeamId ?? undefined) === (b.winnerTeamId ?? undefined) &&
    a.kickoffAt === b.kickoffAt
  )
}

export function applyGameResult(
  existing: NFLGame,
  update: GameResultUpdate,
  options: { releaseCommissionerLock?: boolean } = {},
): ApplyResultOutcome {
  if (update.gameId !== existing.id) {
    return { game: existing, changed: false, reason: 'unknown-game' }
  }
  if (
    existing.resultSource === 'commissioner' &&
    update.source === 'provider' &&
    !options.releaseCommissionerLock
  ) {
    return { game: existing, changed: false, reason: 'commissioner-locked' }
  }

  const winner = deriveWinner(
    update.status,
    existing.homeTeamId,
    existing.awayTeamId,
    update.homeScore,
    update.awayScore,
    update.winnerTeamId,
  )

  const candidate: NFLGame = {
    ...existing,
    status: update.status,
    homeScore:
      update.status === 'final' || update.status === 'in_progress' ? update.homeScore : undefined,
    awayScore:
      update.status === 'final' || update.status === 'in_progress' ? update.awayScore : undefined,
    winnerTeamId: winner,
    kickoffAt: update.kickoffAt ?? existing.kickoffAt,
  }

  if (sameResult(existing, candidate) && (existing.resultSource ?? 'provider') === update.source) {
    return { game: existing, changed: false, reason: 'identical' }
  }

  return {
    game: {
      ...candidate,
      resultVersion: existing.resultVersion + 1,
      resultSource: update.source,
      updatedAt: update.observedAt,
    },
    changed: true,
  }
}

export interface BatchResult {
  games: NFLGame[]
  changed: NFLGame[]
  skipped: Array<{ gameId: string; reason: SkipReason }>
}

export function applyGameResults(
  games: NFLGame[],
  updates: GameResultUpdate[],
  options: { releaseCommissionerLock?: boolean } = {},
): BatchResult {
  const byId = new Map(games.map((g) => [g.id, g]))
  const changed: NFLGame[] = []
  const skipped: BatchResult['skipped'] = []
  for (const update of updates) {
    const existing = byId.get(update.gameId)
    if (!existing) {
      skipped.push({ gameId: update.gameId, reason: 'unknown-game' })
      continue
    }
    const outcome = applyGameResult(existing, update, options)
    if (outcome.changed) {
      byId.set(update.gameId, outcome.game)
      changed.push(outcome.game)
    } else {
      skipped.push({ gameId: update.gameId, reason: outcome.reason ?? 'identical' })
    }
  }
  return { games: games.map((g) => byId.get(g.id) ?? g), changed, skipped }
}
