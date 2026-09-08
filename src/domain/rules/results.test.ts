import { describe, expect, it } from 'vitest'
import type { GameResultUpdate, NFLGame } from '../models'
import { applyGameResult, applyGameResults, deriveWinner, ResultConsistencyError } from './results'

const scheduled: NFLGame = {
  id: 'g1',
  seasonYear: 2026,
  week: 1,
  homeTeamId: 'GB',
  awayTeamId: 'CHI',
  kickoffAt: '2026-09-13T17:00:00.000Z',
  status: 'scheduled',
  resultVersion: 0,
  updatedAt: '2026-09-01T00:00:00.000Z',
}

const finalUpdate: GameResultUpdate = {
  gameId: 'g1',
  status: 'final',
  homeScore: 24,
  awayScore: 17,
  source: 'provider',
  observedAt: '2026-09-13T21:00:00.000Z',
}

describe('applyGameResult', () => {
  it('applies a final and derives the winner from the score', () => {
    const out = applyGameResult(scheduled, finalUpdate)
    expect(out.changed).toBe(true)
    expect(out.game.status).toBe('final')
    expect(out.game.winnerTeamId).toBe('GB')
    expect(out.game.resultVersion).toBe(1)
    expect(out.game.resultSource).toBe('provider')
  })

  it('is idempotent: re-applying the same observation changes nothing', () => {
    const first = applyGameResult(scheduled, finalUpdate).game
    const second = applyGameResult(first, {
      ...finalUpdate,
      observedAt: '2026-09-14T00:00:00.000Z',
    })
    expect(second.changed).toBe(false)
    expect(second.reason).toBe('identical')
    expect(second.game).toBe(first)
    expect(second.game.resultVersion).toBe(1)
  })

  it('records a tie as winner null', () => {
    const out = applyGameResult(scheduled, { ...finalUpdate, homeScore: 20, awayScore: 20 })
    expect(out.game.winnerTeamId).toBeNull()
  })

  it('a provider correction bumps the version again', () => {
    const first = applyGameResult(scheduled, finalUpdate).game
    const corrected = applyGameResult(first, { ...finalUpdate, homeScore: 24, awayScore: 27 })
    expect(corrected.changed).toBe(true)
    expect(corrected.game.winnerTeamId).toBe('CHI')
    expect(corrected.game.resultVersion).toBe(2)
  })

  it('a commissioner result is locked against later provider updates', () => {
    const commish = applyGameResult(scheduled, {
      ...finalUpdate,
      source: 'commissioner',
      homeScore: 10,
      awayScore: 13,
    }).game
    expect(commish.winnerTeamId).toBe('CHI')
    const provider = applyGameResult(commish, finalUpdate)
    expect(provider.changed).toBe(false)
    expect(provider.reason).toBe('commissioner-locked')
    // Releasing the lock lets the provider win again.
    const released = applyGameResult(commish, finalUpdate, { releaseCommissionerLock: true })
    expect(released.changed).toBe(true)
    expect(released.game.winnerTeamId).toBe('GB')
  })

  it('a rescheduled kickoff is a change even without a score', () => {
    const out = applyGameResult(scheduled, {
      gameId: 'g1',
      status: 'postponed',
      kickoffAt: '2026-09-14T23:15:00.000Z',
      source: 'provider',
      observedAt: '2026-09-12T00:00:00.000Z',
    })
    expect(out.changed).toBe(true)
    expect(out.game.status).toBe('postponed')
    expect(out.game.kickoffAt).toBe('2026-09-14T23:15:00.000Z')
    expect(out.game.winnerTeamId).toBeUndefined()
  })

  it('rejects contradictory winner and score', () => {
    expect(() => applyGameResult(scheduled, { ...finalUpdate, winnerTeamId: 'CHI' })).toThrow(
      ResultConsistencyError,
    )
    expect(() => applyGameResult(scheduled, { ...finalUpdate, winnerTeamId: 'DAL' })).toThrow(
      ResultConsistencyError,
    )
  })

  it('a final without scores needs an explicit winner', () => {
    expect(() => deriveWinner('final', 'GB', 'CHI', undefined, undefined, undefined)).toThrow(
      ResultConsistencyError,
    )
    expect(deriveWinner('final', 'GB', 'CHI', undefined, undefined, 'CHI')).toBe('CHI')
    expect(deriveWinner('scheduled', 'GB', 'CHI', undefined, undefined, undefined)).toBeUndefined()
  })
})

describe('applyGameResults (batch)', () => {
  const other: NFLGame = { ...scheduled, id: 'g2', homeTeamId: 'KC', awayTeamId: 'DEN' }

  it('applies a batch once and reports duplicates as skipped on replay', () => {
    const updates: GameResultUpdate[] = [
      finalUpdate,
      { ...finalUpdate, gameId: 'g2', homeScore: 3, awayScore: 30 },
      { ...finalUpdate, gameId: 'ghost' },
    ]
    const first = applyGameResults([scheduled, other], updates)
    expect(first.changed.map((g) => g.id)).toEqual(['g1', 'g2'])
    expect(first.skipped).toEqual([{ gameId: 'ghost', reason: 'unknown-game' }])

    const replay = applyGameResults(first.games, updates)
    expect(replay.changed).toEqual([])
    expect(replay.skipped.map((s) => s.reason)).toEqual(['identical', 'identical', 'unknown-game'])
    expect(replay.games).toEqual(first.games)
  })
})
