import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  FINALS,
  eliminatedWeekOf,
  gamesById,
  pickOf,
  picksIn,
  pinnedThrough,
  season,
} from './seasonFacts'

/**
 * Epitaphs are carved for real people, about real picks. Two ways that goes
 * wrong: burying someone who is still alive, and getting the facts of their
 * downfall wrong. This test guards the first for every epitaph; each epitaph
 * adds its own `it` below for the second, the same way the commissioner's
 * note does.
 *
 * Read from disk rather than imported: tests/unit is compiled by
 * tsconfig.node.json, which does not include src.
 */
const source = readFileSync(new URL('../../src/lib/epitaphs.ts', import.meta.url), 'utf8')
const block = source.slice(source.indexOf('export const EPITAPHS'))

/** Each carved entry: who it is for, and the week it says put them there. */
const carved = [...block.matchAll(/'([a-z0-9-]+)':\s*\{[\s\S]*?writtenAfterWeek:\s*(\d+)/g)].map(
  (m) => ({ playerId: m[1]!, week: Number(m[2]) }),
)

describe('epitaphs bury only the dead', () => {
  it('reads the epitaph table it is guarding', () => {
    expect(block).toMatch(/^export const EPITAPHS: Record<string, Epitaph> = \{/)
    // Every key in the table was parsed, so nothing slips past the guard below.
    const keys = [...block.matchAll(/^\s{2}'([a-z0-9-]+)':/gm)].map((m) => m[1])
    expect(keys).toEqual(carved.map((c) => c.playerId))
  })

  it('writes each one as a single paragraph: their season, start to finish', () => {
    const recaps = [...block.matchAll(/recap:\s*\n?\s*(['`])([\s\S]*?)\1,/g)].map((m) => m[2]!)
    expect(recaps).toHaveLength(carved.length)
    // A real line break or an escaped one in the source: either way, two paragraphs.
    for (const recap of recaps) expect(recap).not.toMatch(/\n|\\n/)
  })

  it('carves a stone only for a player the pinned results actually eliminated, in that week', () => {
    for (const { playerId, week } of carved) {
      expect(
        season.profiles.some((p) => p.playerId === playerId),
        `${playerId} is not on the roster`,
      ).toBe(true)
      expect(
        eliminatedWeekOf(playerId, pinnedThrough),
        `${playerId}'s epitaph says week ${week}; pin that week's finals in seasonFacts first`,
      ).toBe(week)
    }
  })
})

describe('Don Turner’s epitaph', () => {
  const pick = (week: number) => pickOf('Don Turner', week)!
  const scoreFor = (week: number) => {
    const p = pick(week)
    const g = gamesById.get(p.gameId)!
    const [away, home] = FINALS[p.gameId]!
    const mine = p.teamId === g.homeTeamId ? home : away
    const theirs = p.teamId === g.homeTeamId ? away : home
    return {
      mine,
      theirs,
      home: p.teamId === g.homeTeamId,
      opponent: p.teamId === g.homeTeamId ? g.awayTeamId : g.homeTeamId,
    }
  }

  it('“Pittsburgh at home in week 1, a tidy 20–13 over Atlanta”', () => {
    expect(pick(1).teamId).toBe('PIT')
    expect(scoreFor(1)).toMatchObject({ mine: 20, theirs: 13, home: true, opponent: 'ATL' })
  })

  it('“Week 2, Baltimore at home … Week 3, the … Seahawks in Washington’s home opener, beaten 33–31”', () => {
    expect(pick(2).teamId).toBe('BAL')
    expect(scoreFor(2)).toMatchObject({ home: true, mine: 17, theirs: 24 })
    expect(pick(3).teamId).toBe('SEA')
    expect(scoreFor(3)).toMatchObject({ home: false, opponent: 'WAS', mine: 31, theirs: 33 })
    expect(season.games.filter((g) => g.week < 3 && g.homeTeamId === 'WAS')).toHaveLength(0)
  })

  it('“week 4, on his last life, Detroit on Sunday night in Carolina … won 32–26”', () => {
    expect(pick(4).teamId).toBe('DET')
    expect(scoreFor(4)).toMatchObject({ home: false, opponent: 'CAR', mine: 26, theirs: 32 })
    const kickoff = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      weekday: 'long',
      hour: 'numeric',
    })
    expect(kickoff.format(new Date(gamesById.get(pick(4).gameId)!.kickoffAt))).toBe('Sunday 7 PM')
    expect(eliminatedWeekOf('don-turner', pinnedThrough)).toBe(4)
  })

  it('“Three losses by seven, two and six points”', () => {
    expect([2, 3, 4].map((w) => scoreFor(w).theirs - scoreFor(w).mine)).toEqual([7, 2, 6])
  })

  it('“the same team as Corey in weeks 1 and 3 and the same team as Dave and Maya in week 2”', () => {
    expect(pickOf('Corey Cowell', 1)?.teamId).toBe('PIT')
    expect(pickOf('Corey Cowell', 3)?.teamId).toBe('SEA')
    expect(pickOf('Dave Johnson', 2)?.teamId).toBe('BAL')
    expect(pickOf('Maya Israel', 2)?.teamId).toBe('BAL')
  })

  it('“Twenty-eight teams go unused”', () => {
    const used = new Set([1, 2, 3, 4].map((w) => pick(w).teamId))
    expect(32 - used.size).toBe(28)
    expect(picksIn(5).filter((p) => p.playerId === 'don-turner')).toHaveLength(0)
  })
})
