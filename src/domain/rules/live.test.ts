import { describe, expect, it } from 'vitest'
import type { NFLGame } from '../models'
import { changedScores, weekIsLive, LIVE_LEAD_MINUTES } from './live'

const KICKOFF = '2026-09-13T17:00:00.000Z'
const game = (over: Partial<NFLGame> = {}): NFLGame => ({
  id: '2026-w01-NO-at-DET',
  seasonYear: 2026,
  week: 1,
  homeTeamId: 'DET',
  awayTeamId: 'NO',
  kickoffAt: KICKOFF,
  status: 'scheduled',
  resultVersion: 0,
  updatedAt: KICKOFF,
  ...over,
})
const at = (offsetMinutes: number) =>
  new Date(new Date(KICKOFF).getTime() + offsetMinutes * 60_000)

describe('weekIsLive', () => {
  it('is quiet well before kickoff', () => {
    expect(weekIsLive([game()], at(-60))).toBe(false)
  })

  /**
   * The circle this breaks: a provider flips a game to in_progress at kickoff,
   * so a poll waiting for in_progress waits for the very thing it would fetch.
   */
  it('arms just before kickoff, while the game is still marked scheduled', () => {
    expect(weekIsLive([game({ status: 'scheduled' })], at(-LIVE_LEAD_MINUTES))).toBe(true)
  })

  it('stays armed once the game is under way', () => {
    expect(weekIsLive([game({ status: 'in_progress' })], at(45))).toBe(true)
  })

  it('goes quiet once every game is decided', () => {
    expect(weekIsLive([game({ status: 'final' })], at(240))).toBe(false)
  })

  it('does not poll for a game that will never be played', () => {
    expect(weekIsLive([game({ status: 'cancelled' })], at(45))).toBe(false)
    expect(weekIsLive([game({ status: 'postponed' })], at(45))).toBe(false)
  })

  it('stays armed while any one game is still going', () => {
    const slate = [
      game({ id: 'a', status: 'final' }),
      game({ id: 'b', status: 'in_progress' }),
      game({ id: 'c', kickoffAt: '2026-09-14T00:20:00.000Z' }),
    ]
    expect(weekIsLive(slate, at(200))).toBe(true)
  })

  it('has nothing to watch in an empty week', () => {
    expect(weekIsLive([], at(45))).toBe(false)
  })

  it('accepts an ISO string for now, like the rest of the domain', () => {
    expect(weekIsLive([game()], at(45).toISOString())).toBe(true)
  })
})

describe('changedScores', () => {
  it('reports the side that scored', () => {
    expect(changedScores({ homeScore: 7, awayScore: 3 }, { homeScore: 14, awayScore: 3 })).toEqual({
      home: true,
      away: false,
    })
  })

  it('reports both when both moved between readings', () => {
    expect(changedScores({ homeScore: 7, awayScore: 3 }, { homeScore: 10, awayScore: 6 })).toEqual({
      home: true,
      away: true,
    })
  })

  it('reports nothing when the score held', () => {
    expect(changedScores({ homeScore: 7, awayScore: 3 }, { homeScore: 7, awayScore: 3 })).toEqual({
      home: false,
      away: false,
    })
  })

  /** Otherwise every tile flashes on load, which tells the reader nothing. */
  it('treats a first reading as no change', () => {
    expect(changedScores(undefined, { homeScore: 7, awayScore: 0 })).toEqual({
      home: false,
      away: false,
    })
    expect(changedScores({}, { homeScore: 7, awayScore: 0 })).toEqual({
      home: false,
      away: false,
    })
  })

  it('does not flash when a score disappears', () => {
    expect(changedScores({ homeScore: 7, awayScore: 3 }, {})).toEqual({ home: false, away: false })
    expect(changedScores({ homeScore: 7, awayScore: 3 }, undefined)).toEqual({
      home: false,
      away: false,
    })
  })

  it('flashes a score that moves to zero-difference edges', () => {
    expect(changedScores({ homeScore: 0, awayScore: 0 }, { homeScore: 0, awayScore: 2 })).toEqual({
      home: false,
      away: true,
    })
  })
})
