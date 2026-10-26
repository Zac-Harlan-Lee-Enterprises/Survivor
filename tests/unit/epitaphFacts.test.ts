import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  FINALS,
  SCORING,
  TURNOVERS,
  crowd,
  eliminatedWeekOf,
  gamesById,
  lost,
  pickOf,
  picksIn,
  pinnedThrough,
  record,
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

// Records as they stood when these were carved: after week 6.
describe('the week 6 epitaphs', () => {
  const rams = SCORING['2026-w06-ARI-at-LAR']!
  const titans = SCORING['2026-w06-TEN-at-IND']!
  /** Arizona 18, Rams 16: six field goals and no touchdown, the Rams ahead with 0:47 left, the last kick at 0:00. */
  const ramsGame = () => {
    expect(FINALS['2026-w06-ARI-at-LAR']).toEqual([18, 16])
    const arizona = rams.filter(([, , team]) => team === 'ARI')
    expect(arizona).toHaveLength(6)
    expect(arizona.every(([, , , , text]) => /Field Goal$/.test(text))).toBe(true)
    expect(rams.find(([, , , score]) => score.join() === '15,16')?.slice(0, 3)).toEqual([
      4,
      '0:47',
      'LAR',
    ])
    expect(rams.at(-1)!.slice(0, 3)).toEqual([4, '0:00', 'ARI'])
  }
  /** Tennessee, 0–5, won 26–20 at Indianapolis: its first win, a blocked punt, four Joey Slye field goals. */
  const titansGame = () => {
    expect(record('TEN', 5)).toBe('0-5')
    expect(FINALS['2026-w06-TEN-at-IND']).toEqual([26, 20])
    expect(titans.some(([, , team, , text]) => team === 'TEN' && /blocked punt/.test(text))).toBe(
      true,
    )
    expect(
      titans.filter(([, , , , text]) => /^Joey Slye \d+ Yd Field Goal$/.test(text)),
    ).toHaveLength(4)
  }
  /** The Dallas loss of week 5: twenty-one of us, to a Tampa Bay that had not won. */
  const dallas = (name: string) => {
    expect(played(name, 5)).toMatchObject({ teamId: 'DAL', opponent: 'TB', mine: 16, theirs: 24 })
    expect(crowd(5, 'DAL')).toBe(21)
    expect(record('TB', 4)).toBe('0-4')
  }
  const arizonaWins = () => Object.keys(FINALS).filter((id) => winnerOf(id) === 'ARI')

  it('bury exactly the twelve that week 6 eliminated', () => {
    const twelve = [
      'james-parker',
      'stacey-markendorff',
      'sheila-acker',
      'chloe-bourque',
      'corey-cowell',
      'matt-hadley',
      'kc-walker',
      'paul-lim',
      'tony-canody',
      'joanna-moss',
      'tina-bush',
      'zac-harlan',
    ]
    for (const id of twelve) expect(eliminatedWeekOf(id, pinnedThrough), id).toBe(6)
    expect(season.profiles.filter((p) => eliminatedWeekOf(p.playerId, 6) === 6)).toHaveLength(12)
  })

  it('James: Detroit 31–30, the 49ers, Seattle 33–31 in Washington, Minnesota 15–10, Dallas, the Rams with twelve others; one point, two points, never alone', () => {
    expect(played('James Parker', 1)).toMatchObject({
      teamId: 'DET',
      opponent: 'NO',
      mine: 31,
      theirs: 30,
    })
    expect(played('James Parker', 2)).toMatchObject({ teamId: 'SF' })
    expect(winnerOf(played('James Parker', 2)!.gameId)).toBe('SF')
    expect(played('James Parker', 3)).toMatchObject({
      teamId: 'SEA',
      opponent: 'WAS',
      home: false,
      mine: 31,
      theirs: 33,
    })
    expect(played('James Parker', 4)).toMatchObject({ teamId: 'MIN', mine: 15, theirs: 10 })
    dallas('James Parker')
    // “did what most of the league did”
    expect(crowd(5, 'DAL')).toBeGreaterThan(picksIn(5).length / 2)
    expect(livesEntering('james-parker', 6)).toBe(1)
    expect(played('James Parker', 6)).toMatchObject({ teamId: 'LAR', mine: 16, theirs: 18 })
    expect(crowd(6, 'LAR')).toBe(13)
    ramsGame()
    const margins = [1, 2, 3, 4, 5, 6]
      .map((w) => played('James Parker', w)!)
      .map((g) => g.mine - g.theirs)
    expect(margins[0]).toBe(1)
    expect(margins[5]).toBe(-2)
    expect(margins.filter((m) => m < 0)).toEqual([-2, -8, -2])
    const crowds = [1, 2, 3, 4, 5, 6].map((w) => crowd(w, pickOf('James Parker', w)!.teamId))
    expect(Math.min(...crowds)).toBe(4)
    expect(crowds[2]).toBe(4)
  })

  it('Stacey: Arizona’s only two wins, the Chargers (one of seven) and the Rams (one of thirteen); SF, KC, MIN in crowds of eleven and more; Dallas; the Chargers 0–6', () => {
    expect(arizonaWins()).toEqual(['2026-w01-ARI-at-LAC', '2026-w06-ARI-at-LAR'])
    expect(played('Stacey Markendorff', 1)).toMatchObject({
      teamId: 'LAC',
      opponent: 'ARI',
      mine: 14,
      theirs: 26,
    })
    expect(crowd(1, 'LAC')).toBe(7)
    expect(played('Stacey Markendorff', 6)).toMatchObject({ teamId: 'LAR', opponent: 'ARI' })
    ramsGame()
    const middle = [2, 3, 4].map((w) => played('Stacey Markendorff', w)!)
    expect(middle.map((g) => g.teamId)).toEqual(['SF', 'KC', 'MIN'])
    expect(middle.every((g) => g.mine > g.theirs)).toBe(true)
    expect(Math.min(...[2, 3, 4].map((w) => crowd(w, middle[w - 2]!.teamId)))).toBe(11)
    dallas('Stacey Markendorff')
    expect(record('LAC', 6)).toBe('0-6')
  })

  it('Sheila: Seattle 13–10 over New England; won with teams now 13–3, lost with teams now 5–13; Tampa Bay twice; the Rams; right three times, wrong three, wrong last', () => {
    expect(played('Sheila Acker', 1)).toMatchObject({
      teamId: 'SEA',
      opponent: 'NE',
      mine: 13,
      theirs: 10,
    })
    const weeks = [1, 2, 3, 4, 5, 6].map((w) => played('Sheila Acker', w)!)
    const won = weeks.filter((g) => g.mine > g.theirs).map((g) => g.teamId)
    const lostWith = weeks.filter((g) => g.mine <= g.theirs).map((g) => g.teamId)
    expect(won).toEqual(['SEA', 'KC', 'MIN'])
    expect(lostWith).toEqual(['TB', 'DAL', 'LAR'])
    const combined = (teams: string[]) =>
      teams
        .map((t) => record(t, 6).split('-').map(Number))
        .reduce(([w, l], [a, b]) => [w! + a!, l! + b!], [0, 0])
    expect(combined(won)).toEqual([13, 3])
    expect(combined(lostWith)).toEqual([5, 13])
    expect(played('Sheila Acker', 2)).toMatchObject({
      teamId: 'TB',
      opponent: 'CLE',
      mine: 19,
      theirs: 23,
    })
    dallas('Sheila Acker')
    expect(played('Sheila Acker', 6)).toMatchObject({ teamId: 'LAR' })
    expect(crowd(6, 'LAR')).toBe(13)
    ramsGame()
    expect(weeks.slice(-2).every((g) => g.mine < g.theirs)).toBe(true)
  })

  it('Chloe: beat Cleveland, then Cleveland beat her; beat Tennessee, then Tennessee beat her; KC with nineteen others, Dallas with twenty; the only Cowboys-to-Colts', () => {
    expect(played('Chloe Bourque', 1)).toMatchObject({
      teamId: 'JAX',
      opponent: 'CLE',
      mine: 34,
      theirs: 10,
    })
    expect(played('Chloe Bourque', 2)).toMatchObject({
      teamId: 'TB',
      opponent: 'CLE',
      mine: 19,
      theirs: 23,
    })
    expect(played('Chloe Bourque', 4)).toMatchObject({
      teamId: 'BAL',
      opponent: 'TEN',
      mine: 24,
      theirs: 18,
    })
    expect(played('Chloe Bourque', 6)).toMatchObject({
      teamId: 'IND',
      opponent: 'TEN',
      home: true,
      mine: 20,
      theirs: 26,
    })
    titansGame()
    expect(played('Chloe Bourque', 3)).toMatchObject({ teamId: 'KC', mine: 24, theirs: 10 })
    expect(crowd(3, 'KC')).toBe(20)
    dallas('Chloe Bourque')
    const switched = picksIn(5)
      .filter((p) => p.teamId === 'DAL')
      .filter((p) => picksIn(6).some((q) => q.playerId === p.playerId && q.teamId === 'IND'))
    expect(switched.map((p) => p.playerId)).toEqual(['chloe-bourque'])
  })

  it('Corey: Pittsburgh, one of two, 20–13; Tampa Bay and Seattle; one life from week 4; Minnesota 15–10; Houston, one of two, 26–3 in Tennessee, their first win; the Colts; Houston won again; the Seattle four all dead, Corey two weeks after Don', () => {
    expect(played('Corey Cowell', 1)).toMatchObject({ teamId: 'PIT', mine: 20, theirs: 13 })
    expect(crowd(1, 'PIT')).toBe(2)
    expect(played('Corey Cowell', 2)).toMatchObject({
      teamId: 'TB',
      opponent: 'CLE',
      mine: 19,
      theirs: 23,
    })
    expect(played('Corey Cowell', 3)).toMatchObject({
      teamId: 'SEA',
      opponent: 'WAS',
      home: false,
      mine: 31,
      theirs: 33,
    })
    expect(livesEntering('corey-cowell', 4)).toBe(1)
    expect(played('Corey Cowell', 4)).toMatchObject({ teamId: 'MIN', mine: 15, theirs: 10 })
    expect(played('Corey Cowell', 5)).toMatchObject({
      teamId: 'HOU',
      opponent: 'TEN',
      home: false,
      mine: 26,
      theirs: 3,
    })
    expect(crowd(5, 'HOU')).toBe(2)
    expect(record('HOU', 4)).toBe('0-4')
    expect(played('Corey Cowell', 6)).toMatchObject({
      teamId: 'IND',
      opponent: 'TEN',
      mine: 20,
      theirs: 26,
    })
    expect(winnerOf('2026-w06-HOU-at-JAX')).toBe('HOU')
    expect(26 - 3).toBe(23)
    for (const p of picksIn(3).filter((x) => x.teamId === 'SEA')) {
      expect(eliminatedWeekOf(p.playerId, pinnedThrough), p.playerId).not.toBeNull()
    }
    expect(eliminatedWeekOf('don-turner', pinnedThrough)).toBe(4)
    expect(eliminatedWeekOf('corey-cowell', pinnedThrough)! - 4).toBe(2)
    expect([4, 5, 6].every((w) => livesEntering('corey-cowell', w) === 1)).toBe(true)
    // “spent half his season on his last life”
    expect([1, 2, 3, 4, 5, 6].filter((w) => livesEntering('corey-cowell', w) === 1)).toHaveLength(3)
  })

  it('Matt: the only Green Bay pick in week 1, 39–22 at Minnesota, the Vikings unbeaten since; SF, KC, BAL; Dallas with twenty others; the Rams with twelve; Green Bay 23–13 over Dallas', () => {
    expect(played('Matt Hadley', 1)).toMatchObject({
      teamId: 'GB',
      opponent: 'MIN',
      home: false,
      mine: 22,
      theirs: 39,
    })
    expect(crowd(1, 'GB')).toBe(1)
    expect(record('MIN', 6)).toBe('5-0')
    expect([2, 3, 4].map((w) => played('Matt Hadley', w)!.teamId)).toEqual(['SF', 'KC', 'BAL'])
    // “with company”
    expect([2, 3, 4].every((w) => crowd(w, played('Matt Hadley', w)!.teamId) > 1)).toBe(true)
    expect(
      [2, 3, 4].every((w) => played('Matt Hadley', w)!.mine > played('Matt Hadley', w)!.theirs),
    ).toBe(true)
    dallas('Matt Hadley')
    expect(played('Matt Hadley', 6)).toMatchObject({ teamId: 'LAR' })
    ramsGame()
    expect(FINALS['2026-w06-DAL-at-GB']).toEqual([13, 23])
  })

  it('KC: Kansas City in week 3 with nineteen others, the most popular pick, 24–10 in Miami; Jacksonville and Tampa Bay with seven each; Minnesota with sixteen; Dallas; the Rams; Kansas City 5–0', () => {
    expect(played('KC Walker', 3)).toMatchObject({
      teamId: 'KC',
      opponent: 'MIA',
      home: false,
      mine: 24,
      theirs: 10,
    })
    expect(crowd(3, 'KC')).toBe(20)
    expect(Math.max(...picksIn(3).map((p) => crowd(3, p.teamId)))).toBe(20)
    expect(played('KC Walker', 1)).toMatchObject({ teamId: 'JAX', mine: 34, theirs: 10 })
    expect(crowd(1, 'JAX')).toBe(7)
    expect(played('KC Walker', 2)).toMatchObject({
      teamId: 'TB',
      opponent: 'CLE',
      mine: 19,
      theirs: 23,
    })
    expect(crowd(2, 'TB')).toBe(7)
    expect(played('KC Walker', 4)).toMatchObject({ teamId: 'MIN', mine: 15, theirs: 10 })
    expect(crowd(4, 'MIN')).toBe(16)
    dallas('KC Walker')
    expect(played('KC Walker', 6)).toMatchObject({ teamId: 'LAR' })
    expect(crowd(6, 'LAR')).toBe(13)
    ramsGame()
    expect(record('KC', 6)).toBe('5-0')
  })

  it('Paul: the only one to lose a life to a tie; Jacksonville 34–10; Tampa Bay; KC and Minnesota; Washington alone, 27–27; Washington 1–4–1; the Rams with twelve others', () => {
    const ties = Object.keys(FINALS).filter((id) => winnerOf(id) === null)
    expect(ties).toEqual(['2026-w05-NYG-at-WAS'])
    expect(season.picks.filter((p) => ties.includes(p.gameId)).map((p) => p.playerId)).toEqual([
      'paul-lim',
    ])
    expect(played('Paul Lim', 1)).toMatchObject({
      teamId: 'JAX',
      opponent: 'CLE',
      mine: 34,
      theirs: 10,
    })
    expect(played('Paul Lim', 2)).toMatchObject({ teamId: 'TB', mine: 19, theirs: 23 })
    expect([3, 4].map((w) => played('Paul Lim', w)!.teamId)).toEqual(['KC', 'MIN'])
    expect([3, 4].every((w) => played('Paul Lim', w)!.mine > played('Paul Lim', w)!.theirs)).toBe(
      true,
    )
    expect(played('Paul Lim', 5)).toMatchObject({
      teamId: 'WAS',
      opponent: 'NYG',
      mine: 27,
      theirs: 27,
    })
    expect(crowd(5, 'WAS')).toBe(1)
    expect(record('WAS', 6)).toBe('1-4-1')
    expect(played('Paul Lim', 6)).toMatchObject({ teamId: 'LAR' })
    expect(crowd(6, 'LAR')).toBe(13)
    ramsGame()
  })

  it('Tony: alone on Cleveland against seven on Tampa Bay, 23–19; the Chargers (one of seven), 0–6 since; the Rams (one of thirteen); Arizona’s two wins; KC and Baltimore; Dallas with twenty others; alone only once', () => {
    expect(played('Tony Canody', 2)).toMatchObject({
      teamId: 'CLE',
      opponent: 'TB',
      mine: 23,
      theirs: 19,
    })
    expect(crowd(2, 'CLE')).toBe(1)
    expect(crowd(2, 'TB')).toBe(7)
    expect(played('Tony Canody', 1)).toMatchObject({
      teamId: 'LAC',
      opponent: 'ARI',
      mine: 14,
      theirs: 26,
    })
    expect(crowd(1, 'LAC')).toBe(7)
    expect(record('LAC', 6)).toBe('0-6')
    expect(played('Tony Canody', 6)).toMatchObject({
      teamId: 'LAR',
      opponent: 'ARI',
      mine: 16,
      theirs: 18,
    })
    expect(arizonaWins()).toEqual(['2026-w01-ARI-at-LAC', '2026-w06-ARI-at-LAR'])
    expect([3, 4].map((w) => played('Tony Canody', w)!.teamId)).toEqual(['KC', 'BAL'])
    expect(
      [3, 4].every((w) => played('Tony Canody', w)!.mine > played('Tony Canody', w)!.theirs),
    ).toBe(true)
    dallas('Tony Canody')
    const alone = [1, 2, 3, 4, 5, 6].filter((w) => crowd(w, pickOf('Tony Canody', w)!.teamId) === 1)
    expect(alone).toEqual([2])
  })

  it('Joanna: the only one on Dallas in week 1, 28–20 at the Giants, and not on Dallas in week 5; Buffalo 41–31 over Detroit; Seattle 33–31; last life weeks 4–6; Baltimore 24–18 over Tennessee; Houston with only Corey, 26–3 in Tennessee; the Colts with Corey', () => {
    expect(played('Joanna Moss', 1)).toMatchObject({
      teamId: 'DAL',
      opponent: 'NYG',
      home: false,
      mine: 20,
      theirs: 28,
    })
    expect(crowd(1, 'DAL')).toBe(1)
    expect(pickOf('Joanna Moss', 5)?.teamId).not.toBe('DAL')
    expect(crowd(5, 'DAL')).toBe(21)
    expect(played('Joanna Moss', 2)).toMatchObject({
      teamId: 'BUF',
      opponent: 'DET',
      mine: 41,
      theirs: 31,
    })
    expect(played('Joanna Moss', 3)).toMatchObject({ teamId: 'SEA', mine: 31, theirs: 33 })
    expect([4, 5, 6].every((w) => livesEntering('joanna-moss', w) === 1)).toBe(true)
    expect(played('Joanna Moss', 4)).toMatchObject({
      teamId: 'BAL',
      opponent: 'TEN',
      mine: 24,
      theirs: 18,
    })
    expect(played('Joanna Moss', 5)).toMatchObject({
      teamId: 'HOU',
      opponent: 'TEN',
      home: false,
      mine: 26,
      theirs: 3,
    })
    expect(
      picksIn(5)
        .filter((p) => p.teamId === 'HOU')
        .map((p) => p.playerId)
        .sort(),
    ).toEqual(['corey-cowell', 'joanna-moss'])
    expect(played('Joanna Moss', 6)).toMatchObject({
      teamId: 'IND',
      opponent: 'TEN',
      mine: 20,
      theirs: 26,
    })
    expect(pickOf('Corey Cowell', 6)?.teamId).toBe('IND')
    titansGame()
  })

  it('Tina: alone on Buffalo, beaten 29–26 by New England; alone on New England, 45–17 over the Raiders; New England 26–19 in week 6 without her; the Rams with twelve others; Detroit by a point, no week 2 pick, Kansas City; half of New England’s four wins', () => {
    expect(played('Tina Bush', 4)).toMatchObject({
      teamId: 'BUF',
      opponent: 'NE',
      mine: 26,
      theirs: 29,
    })
    expect(crowd(4, 'BUF')).toBe(1)
    expect(played('Tina Bush', 5)).toMatchObject({
      teamId: 'NE',
      opponent: 'LV',
      mine: 45,
      theirs: 17,
    })
    expect(crowd(5, 'NE')).toBe(1)
    expect(FINALS['2026-w06-NYJ-at-NE']).toEqual([19, 26])
    expect(played('Tina Bush', 6)).toMatchObject({ teamId: 'LAR' })
    expect(crowd(6, 'LAR')).toBe(13)
    ramsGame()
    expect(played('Tina Bush', 1)).toMatchObject({ teamId: 'DET', mine: 31, theirs: 30 })
    expect(pickOf('Tina Bush', 2)).toBeNull()
    expect(played('Tina Bush', 3)).toMatchObject({ teamId: 'KC' })
    const neWins = Object.keys(FINALS).filter((id) => winnerOf(id) === 'NE')
    expect(neWins).toHaveLength(4)
    const hers = neWins.filter((id) => [4, 5].some((w) => pickOf('Tina Bush', w)?.gameId === id))
    expect(hers).toHaveLength(2)
  })

  it('Zac: the commissioner, out in week 6; never alone (seven on the Chargers at least); SF, KC, BAL; the two biggest losing crowds; Arizona’s two wins; the Chargers 0–6, the Rams 2–4', () => {
    expect(season.memberships.find((m) => m.playerId === 'zac-harlan')?.role).toBe('commissioner')
    expect(eliminatedWeekOf('zac-harlan', pinnedThrough)).toBe(6)
    const crowds = [1, 2, 3, 4, 5, 6].map((w) => crowd(w, pickOf('Zac Harlan', w)!.teamId))
    expect(Math.min(...crowds)).toBe(7)
    expect(crowds[0]).toBe(7)
    expect(played('Zac Harlan', 1)).toMatchObject({ teamId: 'LAC', mine: 14, theirs: 26 })
    expect([2, 3, 4].map((w) => played('Zac Harlan', w)!.teamId)).toEqual(['SF', 'KC', 'BAL'])
    expect(
      [2, 3, 4].every((w) => played('Zac Harlan', w)!.mine > played('Zac Harlan', w)!.theirs),
    ).toBe(true)
    // Every crowd that lost through week 6 (the epitaph speaks as of then; later
    // weeks' picks arrive before their games are played), biggest first.
    const losing = new Map<string, number>()
    for (const p of season.picks.filter((x) => x.week <= 6))
      if (lost(p)) losing.set(`${p.week}-${p.teamId}`, crowd(p.week, p.teamId))
    const biggest = [...losing.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)
    expect(biggest).toEqual([
      ['5-DAL', 21],
      ['6-LAR', 13],
    ])
    expect([5, 6].map((w) => pickOf('Zac Harlan', w)!.teamId)).toEqual(['DAL', 'LAR'])
    expect(arizonaWins()).toEqual(['2026-w01-ARI-at-LAC', '2026-w06-ARI-at-LAR'])
    expect(record('LAC', 6)).toBe('0-6')
    expect(record('LAR', 6)).toBe('2-4')
  })
})

describe('the week 7 epitaphs', () => {
  const W = 7
  const won = (name: string, week: number) => {
    const g = played(name, week)!
    return g.mine > g.theirs
  }
  /** Houston: tied 21–21 with 0:52 left, lost to the Giants in overtime. */
  const houston = (name: string) => {
    expect(played(name, W)).toMatchObject({ teamId: 'HOU', opponent: 'NYG', mine: 21, theirs: 27 })
    const plays = SCORING['2026-w07-NYG-at-HOU']!
    expect(plays.find(([, , , sc]) => sc.join() === '21,21')!.slice(0, 2)).toEqual([4, '0:52'])
    expect(plays.at(-1)![0]).toBe(5)
  }
  const topLost = (week: number) => {
    const counts = new Map<string, number>()
    for (const p of picksIn(week)) counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1)
    const most = Math.max(...counts.values())
    const [team] = [...counts.entries()].find(([, n]) => n === most)!
    return {
      team,
      n: most,
      lost: picksIn(week)
        .filter((p) => p.teamId === team)
        .every(lost),
    }
  }
  const unbeatenGoingIntoWeek7 = () => {
    const teams = [...new Set(season.games.flatMap((g) => [g.homeTeamId, g.awayTeamId]))]
    return teams.filter((t) => /^\d+-0$/.test(record(t, 6))).sort()
  }

  it('bury exactly the seven that week 7 eliminated', () => {
    const seven = [
      'bradley-riedell',
      'maya-israel',
      'mike-lancaster',
      'shahid-ali',
      'dave-johnson',
      'jason-snook',
      'wesley-childers',
    ]
    for (const id of seven) expect(eliminatedWeekOf(id, pinnedThrough), id).toBe(W)
    expect(season.profiles.filter((p) => eliminatedWeekOf(p.playerId, W) === W)).toHaveLength(7)
  })

  it('Bradley: Detroit 31–30; alone on Chicago (9–3 to Minnesota) and on San Francisco (23–17 over Washington), 1–1; in company 3–2; Houston with five others; all three unbeaten teams spent', () => {
    expect(played('Bradley Riedell', 1)).toMatchObject({ teamId: 'DET', mine: 31, theirs: 30 })
    expect(played('Bradley Riedell', 2)).toMatchObject({
      teamId: 'CHI',
      opponent: 'MIN',
      mine: 3,
      theirs: 9,
    })
    expect(played('Bradley Riedell', 6)).toMatchObject({
      teamId: 'SF',
      opponent: 'WAS',
      mine: 23,
      theirs: 17,
    })
    const weeks = [1, 2, 3, 4, 5, 6, 7]
    const alone = weeks.filter((w) => crowd(w, pickOf('Bradley Riedell', w)!.teamId) === 1)
    expect(alone).toEqual([2, 6])
    expect(alone.map((w) => won('Bradley Riedell', w))).toEqual([false, true])
    const company = weeks.filter((w) => !alone.includes(w))
    expect(company.map((w) => crowd(w, pickOf('Bradley Riedell', w)!.teamId))).toEqual([
      6, 20, 16, 21, 6,
    ])
    expect(company.filter((w) => won('Bradley Riedell', w))).toHaveLength(3)
    expect(livesEntering('bradley-riedell', W)).toBe(1)
    houston('Bradley Riedell')
    const used = new Set(
      season.picks
        .filter((p) => p.playerId === 'bradley-riedell' && p.week < W)
        .map((p) => p.teamId),
    )
    expect(unbeatenGoingIntoWeek7().every((t) => used.has(t))).toBe(true)
  })

  it('Maya: Baltimore in week 2 with Don and Dave, 24–17 to New Orleans; Don in week 4, she and Dave in week 7; JAX, KC, MIN; Dallas with twenty others; New England over the Jets, one of four; “My pick for this week: Houston”, Tuesday 10:16 PM', () => {
    expect(played('Maya Israel', 2)).toMatchObject({
      teamId: 'BAL',
      opponent: 'NO',
      mine: 17,
      theirs: 24,
    })
    const ravens = picksIn(2)
      .filter((p) => p.teamId === 'BAL')
      .map((p) => p.playerId)
      .sort()
    expect(ravens).toEqual(['dave-johnson', 'don-turner', 'maya-israel'])
    expect(eliminatedWeekOf('don-turner', pinnedThrough)).toBe(4)
    expect(eliminatedWeekOf('dave-johnson', pinnedThrough)).toBe(W)
    expect([1, 3, 4].map((w) => played('Maya Israel', w)!.teamId)).toEqual(['JAX', 'KC', 'MIN'])
    expect([1, 3, 4].every((w) => won('Maya Israel', w))).toBe(true)
    expect(played('Maya Israel', 5)).toMatchObject({ teamId: 'DAL', mine: 16, theirs: 24 })
    expect(crowd(5, 'DAL')).toBe(21)
    expect(played('Maya Israel', 6)).toMatchObject({
      teamId: 'NE',
      opponent: 'NYJ',
      mine: 26,
      theirs: 19,
    })
    expect(crowd(6, 'NE')).toBe(4)
    expect(livesEntering('maya-israel', W)).toBe(1)
    const sent = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      weekday: 'long',
      hour: 'numeric',
      minute: '2-digit',
    })
    expect(sent.format(new Date(pickOf('Maya Israel', W)!.submittedAt))).toBe('Tuesday 10:16 PM')
    houston('Maya Israel')
  })

  it('Mike: Seattle by three over New England, SF, KC, BAL; then the most popular pick three weeks running, all lost (twenty others, twelve, five); three lives into week 5', () => {
    expect(played('Mike Lancaster', 1)).toMatchObject({
      teamId: 'SEA',
      opponent: 'NE',
      mine: 13,
      theirs: 10,
    })
    expect([2, 3, 4].map((w) => played('Mike Lancaster', w)!.teamId)).toEqual(['SF', 'KC', 'BAL'])
    expect([1, 2, 3, 4].every((w) => won('Mike Lancaster', w))).toBe(true)
    expect(livesEntering('mike-lancaster', 5)).toBe(3)
    for (const [w, n] of [
      [5, 21],
      [6, 13],
      [7, 6],
    ] as const) {
      const t = topLost(w)
      expect(pickOf('Mike Lancaster', w)!.teamId).toBe(t.team)
      expect(t.n).toBe(n)
      expect(t.lost).toBe(true)
    }
    houston('Mike Lancaster')
  })

  it('Shahid: Baltimore at Indianapolis with Dominic, 41–23; SF, KC, MIN — the three unbeaten going into week 7 — in his first four weeks; 4–0 with three lives; then the most popular pick three weeks running, all lost', () => {
    expect(played('Shahid Ali', 1)).toMatchObject({
      teamId: 'BAL',
      opponent: 'IND',
      home: false,
      mine: 41,
      theirs: 23,
    })
    expect(
      picksIn(1)
        .filter((p) => p.teamId === 'BAL')
        .map((p) => p.playerId)
        .sort(),
    ).toEqual(['dominic-green', 'shahid-ali'])
    expect([2, 3, 4].map((w) => played('Shahid Ali', w)!.teamId).sort()).toEqual(
      unbeatenGoingIntoWeek7(),
    )
    // “in his first four weeks”: weeks 2, 3 and 4, above.
    expect([1, 2, 3, 4].every((w) => won('Shahid Ali', w))).toBe(true)
    expect(livesEntering('shahid-ali', 5)).toBe(3)
    for (const w of [5, 6, 7]) {
      const t = topLost(w)
      expect(pickOf('Shahid Ali', w)!.teamId).toBe(t.team)
      expect(t.lost).toBe(true)
    }
  })

  it('Dave: Detroit 31–30; Baltimore with Don and Maya; KC, Chicago over the Jets, Cincinnati at Miami; the Colts, and 0–5 Tennessee’s first win; the Jets, and 0–5 Miami’s first win', () => {
    expect(played('Dave Johnson', 1)).toMatchObject({ teamId: 'DET', mine: 31, theirs: 30 })
    expect(played('Dave Johnson', 2)).toMatchObject({ teamId: 'BAL', mine: 17, theirs: 24 })
    expect(played('Dave Johnson', 3)).toMatchObject({ teamId: 'KC', mine: 24, theirs: 10 })
    expect(played('Dave Johnson', 4)).toMatchObject({
      teamId: 'CHI',
      opponent: 'NYJ',
      mine: 23,
      theirs: 12,
    })
    expect(played('Dave Johnson', 5)).toMatchObject({
      teamId: 'CIN',
      opponent: 'MIA',
      home: false,
      mine: 31,
      theirs: 24,
    })
    expect(played('Dave Johnson', 6)).toMatchObject({
      teamId: 'IND',
      opponent: 'TEN',
      mine: 20,
      theirs: 26,
    })
    expect(record('TEN', 5)).toBe('0-5')
    expect(played('Dave Johnson', 7)).toMatchObject({
      teamId: 'NYJ',
      opponent: 'MIA',
      mine: 25,
      theirs: 28,
    })
    expect(record('MIA', 6)).toBe('0-5')
  })

  it('Jason: JAX, SF, DET, MIN with three lives; alone on Detroit, 31–24 over the Jets; Dallas (21) and the Rams (13), the two biggest losing crowds; alone on Carolina, 43–13, four turnovers, the blocked extra point returned for two', () => {
    expect([1, 2, 3, 4].map((w) => played('Jason Snook', w)!.teamId)).toEqual([
      'JAX',
      'SF',
      'DET',
      'MIN',
    ])
    expect([1, 2, 3, 4].every((w) => won('Jason Snook', w))).toBe(true)
    expect(livesEntering('jason-snook', 5)).toBe(3)
    expect(played('Jason Snook', 3)).toMatchObject({
      teamId: 'DET',
      opponent: 'NYJ',
      mine: 31,
      theirs: 24,
    })
    expect(crowd(3, 'DET')).toBe(1)
    const losing = new Map<string, number>()
    for (const p of season.picks.filter((x) => x.week <= W))
      if (lost(p)) losing.set(`${p.week}-${p.teamId}`, crowd(p.week, p.teamId))
    expect([...losing.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)).toEqual([
      ['5-DAL', 21],
      ['6-LAR', 13],
    ])
    expect([5, 6].map((w) => pickOf('Jason Snook', w)!.teamId)).toEqual(['DAL', 'LAR'])
    expect(played('Jason Snook', W)).toMatchObject({
      teamId: 'CAR',
      opponent: 'TB',
      mine: 13,
      theirs: 43,
    })
    expect(crowd(W, 'CAR')).toBe(1)
    expect(TURNOVERS['2026-w07-TB-at-CAR']!.CAR).toBe(4)
    expect(
      SCORING['2026-w07-TB-at-CAR']!.some(
        ([, , team, , text]) => team === 'TB' && /Defensive PAT Conversion/.test(text),
      ),
    ).toBe(true)
    const alone = [1, 2, 3, 4, 5, 6, 7].filter(
      (w) => crowd(w, pickOf('Jason Snook', w)!.teamId) === 1,
    )
    expect(alone).toEqual([3, 7])
  })

  it('Wesley: Detroit by a point, SF, KC, BAL; three lives in October; Dallas with twenty others; no pick in weeks 6 and 7; the only one eliminated in a week he sent no pick', () => {
    expect(played('Wesley Childers', 1)).toMatchObject({ teamId: 'DET', mine: 31, theirs: 30 })
    expect([2, 3, 4].map((w) => played('Wesley Childers', w)!.teamId)).toEqual(['SF', 'KC', 'BAL'])
    expect([1, 2, 3, 4].every((w) => won('Wesley Childers', w))).toBe(true)
    expect(livesEntering('wesley-childers', 5)).toBe(3)
    expect(
      gamesById.get(pickOf('Wesley Childers', 4)!.gameId)!.kickoffAt.startsWith('2026-10'),
    ).toBe(true)
    expect(played('Wesley Childers', 5)).toMatchObject({ teamId: 'DAL', mine: 16, theirs: 24 })
    expect(crowd(5, 'DAL')).toBe(21)
    expect(pickOf('Wesley Childers', 6)).toBeNull()
    expect(pickOf('Wesley Childers', 7)).toBeNull()
    const silentDeaths = season.profiles.filter((p) => {
      const w = eliminatedWeekOf(p.playerId, pinnedThrough)
      return w !== null && !season.picks.some((x) => x.playerId === p.playerId && x.week === w)
    })
    expect(silentDeaths.map((p) => p.playerId)).toEqual(['wesley-childers'])
  })
})
