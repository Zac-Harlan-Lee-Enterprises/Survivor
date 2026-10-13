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
  winnerOf,
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

/** One player's pick in a week, with the game as it finished. */
function played(displayName: string, week: number) {
  const p = pickOf(displayName, week)
  if (!p) return null
  const g = gamesById.get(p.gameId)!
  const [away, home] = FINALS[p.gameId]!
  const isHome = p.teamId === g.homeTeamId
  return {
    teamId: p.teamId,
    mine: isHome ? home : away,
    theirs: isHome ? away : home,
    home: isHome,
    opponent: isHome ? g.awayTeamId : g.homeTeamId,
    gameId: p.gameId,
  }
}
const livesEntering = (playerId: string, week: number) => {
  let lives = 3
  for (let w = 1; w < week; w++) {
    const p = season.picks.find((x) => x.playerId === playerId && x.week === w)
    if (!p || winnerOf(p.gameId) !== p.teamId) lives -= 1
  }
  return lives
}

describe('the week 5 epitaphs', () => {
  it('bury exactly the five that week 5 eliminated', () => {
    for (const id of [
      'craig-mowers',
      'jared-marks',
      'joseph-tomczuk',
      'nate-adams',
      'phyllis-collins',
    ]) {
      expect(eliminatedWeekOf(id, pinnedThrough), id).toBe(5)
    }
  })

  it('Craig: Chargers 26–14, no week 2 pick, last life from week 3, KC 24–10, CHI 23–12, “Dallas week 5 so I don’t forget later”, 24–16', () => {
    expect(played('Craig Mowers', 1)).toMatchObject({ teamId: 'LAC', mine: 14, theirs: 26 })
    expect(pickOf('Craig Mowers', 2)).toBeNull()
    expect(livesEntering('craig-mowers', 3)).toBe(1)
    expect(played('Craig Mowers', 3)).toMatchObject({
      teamId: 'KC',
      mine: 24,
      theirs: 10,
      opponent: 'MIA',
    })
    expect(played('Craig Mowers', 4)).toMatchObject({
      teamId: 'CHI',
      mine: 23,
      theirs: 12,
      opponent: 'NYJ',
    })
    expect(played('Craig Mowers', 5)).toMatchObject({
      teamId: 'DAL',
      mine: 16,
      theirs: 24,
      opponent: 'TB',
    })
    // His pick came in on the Monday of week 5.
    const at = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'long' })
    expect(at.format(new Date(pickOf('Craig Mowers', 5)!.submittedAt))).toBe('Monday')
  })

  it('Jared: Chargers, no counted week 2 pick, last life by week 3, Buffalo over the Chargers 24–16, MIN 15–10, the biggest crowd ever', () => {
    expect(played('Jared Marks', 1)).toMatchObject({ teamId: 'LAC', mine: 14, theirs: 26 })
    expect(pickOf('Jared Marks', 2)).toBeNull()
    expect(livesEntering('jared-marks', 3)).toBe(1)
    expect(played('Jared Marks', 3)).toMatchObject({
      teamId: 'BUF',
      opponent: 'LAC',
      mine: 24,
      theirs: 16,
    })
    expect(played('Jared Marks', 4)).toMatchObject({ teamId: 'MIN', mine: 15, theirs: 10 })
    expect(played('Jared Marks', 5)).toMatchObject({ teamId: 'DAL', mine: 16, theirs: 24 })
    const biggest = (w: number) => {
      const c = new Map<string, number>()
      for (const p of picksIn(w)) c.set(p.teamId, (c.get(p.teamId) ?? 0) + 1)
      return Math.max(...c.values())
    }
    expect(biggest(5)).toBe(21)
    for (const w of [1, 2, 3, 4]) expect(biggest(w)).toBeLessThan(21)
  })

  it('Joey: JAX 34–10, TB 23–19 to Cleveland, against the Bears 27–7 on his second life, MIN 15–10 on his last, DAL; Bears 31–7 at Green Bay', () => {
    expect(played('Joseph Tomczuk', 1)).toMatchObject({ teamId: 'JAX', mine: 34, theirs: 10 })
    expect(played('Joseph Tomczuk', 2)).toMatchObject({
      teamId: 'TB',
      opponent: 'CLE',
      mine: 19,
      theirs: 23,
    })
    expect(livesEntering('joseph-tomczuk', 3)).toBe(2)
    expect(played('Joseph Tomczuk', 3)).toMatchObject({
      teamId: 'PHI',
      opponent: 'CHI',
      home: false,
      mine: 7,
      theirs: 27,
    })
    expect(27 - 7).toBe(20)
    expect(livesEntering('joseph-tomczuk', 4)).toBe(1)
    expect(played('Joseph Tomczuk', 4)).toMatchObject({ teamId: 'MIN', mine: 15, theirs: 10 })
    expect(played('Joseph Tomczuk', 5)).toMatchObject({ teamId: 'DAL', mine: 16, theirs: 24 })
    expect(FINALS['2026-w05-CHI-at-GB']).toEqual([7, 31])
  })

  it('Nate: the only one burned by both the Chargers and the Bucs, last life by week 3, the unbeaten 49ers, MIN, DAL', () => {
    const chargers = new Set(
      picksIn(1)
        .filter((p) => p.teamId === 'LAC')
        .map((p) => p.playerId),
    )
    const bucs = new Set(
      picksIn(2)
        .filter((p) => p.teamId === 'TB')
        .map((p) => p.playerId),
    )
    expect([...chargers].filter((id) => bucs.has(id))).toEqual(['nate-adams'])
    expect(played('Nate Adams', 2)).toMatchObject({ teamId: 'TB', mine: 19, theirs: 23 })
    expect(livesEntering('nate-adams', 3)).toBe(1)
    expect(played('Nate Adams', 3)).toMatchObject({
      teamId: 'SF',
      opponent: 'ARI',
      mine: 36,
      theirs: 30,
    })
    expect(['2026-w01-SF-at-LAR', '2026-w02-MIA-at-SF'].every((id) => winnerOf(id) === 'SF')).toBe(
      true,
    )
    expect(played('Nate Adams', 4)).toMatchObject({ teamId: 'MIN', mine: 15, theirs: 10 })
    expect(played('Nate Adams', 5)).toMatchObject({
      teamId: 'DAL',
      opponent: 'TB',
      mine: 16,
      theirs: 24,
    })
  })

  it('Phyllis: the opening game every week, two wins then three straight losses, last life by week 5', () => {
    for (const w of [1, 2, 3, 4, 5]) {
      const opener = season.games
        .filter((g) => g.week === w)
        .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))[0]!
      expect(pickOf('Phyllis Collins', w)?.gameId, `week ${w}`).toBe(opener.id)
    }
    expect(played('Phyllis Collins', 1)).toMatchObject({
      teamId: 'SEA',
      opponent: 'NE',
      mine: 13,
      theirs: 10,
    })
    expect(played('Phyllis Collins', 2)).toMatchObject({ teamId: 'BUF', mine: 41, theirs: 31 })
    expect(played('Phyllis Collins', 3)).toMatchObject({
      teamId: 'GB',
      opponent: 'ATL',
      mine: 14,
      theirs: 35,
    })
    expect(FINALS['2026-w02-CAR-at-ATL']).toEqual([34, 3])
    expect(played('Phyllis Collins', 4)).toMatchObject({
      teamId: 'PIT',
      opponent: 'CLE',
      mine: 24,
      theirs: 27,
    })
    expect(livesEntering('phyllis-collins', 5)).toBe(1)
    expect(played('Phyllis Collins', 5)).toMatchObject({ teamId: 'DAL', mine: 16, theirs: 24 })
  })
})
