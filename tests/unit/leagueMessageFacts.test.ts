import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The commissioner's note states numbers about the league, and the league is
 * read by the people those numbers are about. A stat that has quietly gone
 * stale — one more pick arrives and "eleven of you" becomes twelve — is worse
 * than no stat, because it is the kind of wrong nobody checks until someone is
 * annoyed about their own name.
 *
 * So every counted claim in the current note is asserted here against the
 * season it describes. When these fail, the note needs rewriting: that is the
 * signal working, not a broken test.
 *
 * Read from disk rather than imported, like cropNudges.test.ts next door:
 * tests/unit is compiled by tsconfig.node.json, which does not include src.
 */
interface Pick {
  playerId: string
  week: number
  teamId: string
  gameId: string
}
interface Game {
  id: string
  week: number
  homeTeamId: string
  awayTeamId: string
  kickoffAt: string
}
interface Season {
  picks: Pick[]
  games: Game[]
  profiles: { playerId: string; displayName: string }[]
  memberships: { playerId: string; role: string }[]
}

const season = JSON.parse(
  readFileSync(new URL('../../src/data/demo/fixtures/demo-season.json', import.meta.url), 'utf8'),
) as Season

/**
 * Every week 1, 2 and 3 final, as the ESPN scoreboard
 * reports them (site.api.espn.com, 2026 season type 2, weeks 1 to 3, read on
 * 2026-09-22 and 2026-09-29). The seed deliberately carries no results — the app fetches them
 * live — so the note's outcome claims are pinned here instead, keyed by the
 * seed's own game ids so a pick and its result cannot drift apart.
 *
 * `[away, home]` scores, in the same order as the game id reads.
 */
const FINALS: Record<string, [number, number]> = {
  '2026-w01-NE-at-SEA': [10, 13],
  '2026-w01-SF-at-LAR': [27, 7],
  '2026-w01-TB-at-CIN': [27, 33],
  '2026-w01-NO-at-DET': [30, 31],
  '2026-w01-NYJ-at-TEN': [23, 10],
  '2026-w01-BAL-at-IND': [41, 23],
  '2026-w01-ATL-at-PIT': [13, 20],
  '2026-w01-CHI-at-CAR': [59, 37],
  '2026-w01-CLE-at-JAX': [10, 34],
  '2026-w01-BUF-at-HOU': [36, 31],
  '2026-w01-MIA-at-LV': [13, 27],
  '2026-w01-GB-at-MIN': [22, 39],
  '2026-w01-WAS-at-PHI': [22, 24],
  '2026-w01-ARI-at-LAC': [26, 14],
  '2026-w01-DAL-at-NYG': [20, 28],
  '2026-w01-DEN-at-KC': [10, 31],
  '2026-w02-DET-at-BUF': [31, 41],
  '2026-w02-CAR-at-ATL': [34, 3],
  '2026-w02-MIN-at-CHI': [9, 3],
  '2026-w02-PHI-at-TEN': [24, 20],
  '2026-w02-PIT-at-NE': [3, 20],
  '2026-w02-GB-at-NYJ': [20, 17],
  '2026-w02-CLE-at-TB': [23, 19],
  '2026-w02-NO-at-BAL': [24, 17],
  '2026-w02-CIN-at-HOU': [20, 6],
  '2026-w02-JAX-at-DEN': [13, 20],
  '2026-w02-LV-at-LAC': [26, 14],
  '2026-w02-WAS-at-DAL': [20, 37],
  '2026-w02-SEA-at-ARI': [31, 7],
  '2026-w02-MIA-at-SF': [13, 35],
  '2026-w02-IND-at-KC': [30, 33],
  '2026-w02-NYG-at-LAR': [6, 28],
  '2026-w03-ATL-at-GB': [35, 14],
  '2026-w03-LAC-at-BUF': [16, 24],
  '2026-w03-CAR-at-CLE': [18, 21],
  '2026-w03-NYJ-at-DET': [24, 31],
  '2026-w03-HOU-at-IND': [17, 19],
  '2026-w03-KC-at-MIA': [24, 10],
  '2026-w03-TEN-at-NYG': [7, 12],
  '2026-w03-CIN-at-PIT': [27, 30],
  '2026-w03-SEA-at-WAS': [31, 33],
  '2026-w03-NE-at-JAX': [6, 35],
  '2026-w03-ARI-at-SF': [30, 36],
  '2026-w03-MIN-at-TB': [23, 16],
  '2026-w03-BAL-at-DAL': [34, 31],
  '2026-w03-LV-at-NO': [35, 27],
  '2026-w03-LAR-at-DEN': [26, 30],
  '2026-w03-PHI-at-CHI': [7, 27],
}

const WEEK = 3
const gamesById = new Map(season.games.map((g) => [g.id, g]))
const nameOf = (playerId: string) =>
  season.profiles.find((p) => p.playerId === playerId)?.displayName ?? playerId
const picksIn = (week: number) => season.picks.filter((p) => p.week === week)
const picks = picksIn(WEEK)
const pickOf = (displayName: string, week: number) =>
  season.picks.find((p) => p.week === week && nameOf(p.playerId) === displayName) ?? null

const winnerOf = (gameId: string) => {
  const game = gamesById.get(gameId)
  const final = FINALS[gameId]
  if (!game || !final) throw new Error(`no final pinned for ${gameId}`)
  const [away, home] = final
  return away > home ? game.awayTeamId : game.homeTeamId
}
/** True when the pick's team lost. No ties in weeks 1–3, so this is the whole question. */
const lost = (p: Pick) => winnerOf(p.gameId) !== p.teamId

/** A team's record over the pinned finals, from the schedule. */
const record = (teamId: string) => {
  let wins = 0
  let losses = 0
  for (const [id] of Object.entries(FINALS)) {
    const g = gamesById.get(id)
    if (!g || (g.homeTeamId !== teamId && g.awayTeamId !== teamId)) continue
    if (winnerOf(id) === teamId) wins += 1
    else losses += 1
  }
  return `${wins}-${losses}`
}

/** Lives after `through`, from picks and the pinned finals: three, minus a life per loss or silence. */
const livesAfter = (through: number) => {
  const byPlayer = new Map<string, number>()
  for (const profile of season.profiles) {
    let lives = 3
    for (let week = 1; week <= through; week++) {
      const pick = season.picks.find((p) => p.playerId === profile.playerId && p.week === week)
      if (!pick || lost(pick)) lives -= 1
    }
    byPlayer.set(profile.displayName, lives)
  }
  return byPlayer
}
const lives = livesAfter(WEEK)
const onLives = (n: number) =>
  [...lives.entries()]
    .filter(([, l]) => l === n)
    .map(([name]) => name.split(' ')[0]!)
    .sort()

const note = readFileSync(
  new URL('../../src/features/league-home/LeagueMessage.tsx', import.meta.url),
  'utf8',
)
const body = note.slice(note.indexOf('const WEEK_4_PREVIEW'), note.indexOf('const NOTES'))
/** The note's copy, sentence by sentence — the unit a reader takes a hint from. */
const sentences = [...body.matchAll(/'([^']*(?:’[^']*)*)'/g)]
  .map((m) => m[1]!)
  .flatMap((line) => line.split(/(?<=[.!?:])\s+/))

/** City and nickname for each team, from the domain's own table. */
const teamsSource = readFileSync(new URL('../../src/domain/teams.ts', import.meta.url), 'utf8')
const teamWords = new Map(
  [...teamsSource.matchAll(/\['([A-Z]{2,3})', '([^']+)', '([^']+)'/g)].map((m) => [
    m[1]!,
    [m[2]!, m[3]!],
  ]),
)
/** What the league calls each player; Joseph Tomczuk goes by Joey. */
const callNames = (displayName: string) => {
  const first = displayName.split(' ')[0]!
  return first === 'Joseph' ? [first, 'Joey'] : [first]
}

describe('the week 4 preview gives away nobody’s pick', () => {
  it('never names a player in the same sentence as their week 4 team', () => {
    expect(teamWords.size).toBe(32)
    expect(sentences.length).toBeGreaterThan(20)
    for (const pick of picksIn(4)) {
      const words = teamWords.get(pick.teamId)!
      const names = callNames(nameOf(pick.playerId))
      for (const sentence of sentences) {
        const named = names.some((n) => new RegExp(`\\b${n}\\b`).test(sentence))
        const teamed = words.some((w) => sentence.includes(w))
        expect(
          named && teamed,
          `${nameOf(pick.playerId)} beside ${pick.teamId}: “${sentence}”`,
        ).toBe(false)
      }
    }
  })

  it('does not count, or describe, this week’s picks', () => {
    expect(body).not.toMatch(/picks are in|have picked|has picked|of you (are|is) on|still owe/i)
  })
})

describe('the commissioner’s week 4 preview states only true things', () => {
  it('“twenty-four of thirty survived and nobody is out. Eight … perfect, fifteen … two … seven … one”', () => {
    expect(picks.filter((p) => !lost(p))).toHaveLength(24)
    expect(onLives(0)).toEqual([])
    expect(onLives(3)).toHaveLength(8)
    expect(onLives(2)).toHaveLength(15)
    expect(onLives(1)).toHaveLength(7)
  })

  it('“the most popular pick in its history” — twenty on Kansas City in week 3', () => {
    const biggest = (week: number) => {
      const counts = new Map<string, number>()
      for (const p of picksIn(week)) counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1)
      return Math.max(...counts.values())
    }
    expect(picks.filter((p) => p.teamId === 'KC')).toHaveLength(20)
    expect(biggest(1)).toBeLessThan(20)
    expect(biggest(2)).toBeLessThan(20)
  })

  it('“Joey … picked against the Bears on Monday night and lost a life … now on one life”', () => {
    const joey = pickOf('Joseph Tomczuk', 3)!
    expect(joey.teamId).toBe('PHI')
    expect(gamesById.get(joey.gameId)?.homeTeamId).toBe('CHI')
    const day = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'long' })
    expect(day.format(new Date(gamesById.get(joey.gameId)!.kickoffAt))).toBe('Monday')
    expect(lost(joey)).toBe(true)
    expect(lives.get('Joseph Tomczuk')).toBe(1)
  })

  const week4 = season.games.filter((g) => g.week === 4)
  const has = (away: string, home: string) =>
    week4.some((g) => g.awayTeamId === away && g.homeTeamId === home)

  it('“Kansas City at Las Vegas, two 3–0 teams, and twenty of you … spent Kansas City last week”', () => {
    expect(has('KC', 'LV')).toBe(true)
    expect(record('KC')).toBe('3-0')
    expect(record('LV')).toBe('3-0')
    expect(picks.filter((p) => p.teamId === 'KC')).toHaveLength(20)
  })

  it('“San Francisco … 3–0 and host Denver. Buffalo … 3–0 … New England. Minnesota … 3–0 … Miami … thirteen or fewer … ten”', () => {
    expect(has('DEN', 'SF')).toBe(true)
    expect(has('NE', 'BUF')).toBe(true)
    expect(has('MIA', 'MIN')).toBe(true)
    for (const t of ['SF', 'BUF', 'MIN']) expect(record(t)).toBe('3-0')
    const miami = Object.entries(FINALS)
      .filter(([id]) => id.includes('MIA'))
      .map(([id, [away, home]]) => (gamesById.get(id)?.awayTeamId === 'MIA' ? away : home))
    expect(miami.every((pts) => pts <= 13)).toBe(true)
    expect(miami.at(-1)).toBe(10)
  })

  it('“the 0–3 club … five members: Tennessee … Houston … Tampa Bay … Miami … the Chargers” and their week 4 games', () => {
    const teams = [...teamWords.keys()]
    expect(teams.filter((t) => record(t) === '0-3').sort()).toEqual([
      'HOU',
      'LAC',
      'MIA',
      'TB',
      'TEN',
    ])
    expect(has('TEN', 'BAL')).toBe(true)
    expect(has('DAL', 'HOU')).toBe(true)
    expect(has('GB', 'TB')).toBe(true)
    expect(has('LAC', 'SEA')).toBe(true)
  })

  it('“Seven of us spent week 1 on the Chargers … lost to Arizona, Las Vegas and Buffalo”', () => {
    expect(picksIn(1).filter((p) => p.teamId === 'LAC')).toHaveLength(7)
    for (const id of ['2026-w01-ARI-at-LAC', '2026-w02-LV-at-LAC', '2026-w03-LAC-at-BUF']) {
      expect(winnerOf(id)).not.toBe('LAC')
    }
  })

  it('“Pittsburgh at Cleveland tonight … locks … London at 8:30 on Sunday morning … the earliest kickoff … Detroit … Sunday night at Carolina … Atlanta … Monday night at New Orleans”', () => {
    const at = (iso: string, opts: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', ...opts }).format(
        new Date(iso),
      )
    const opener = [...week4].sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))[0]!
    expect([opener.awayTeamId, opener.homeTeamId]).toEqual(['PIT', 'CLE'])
    expect(at(opener.kickoffAt, { weekday: 'long' })).toBe('Thursday')
    const london = week4.find((g) => g.awayTeamId === 'IND' && g.homeTeamId === 'WAS')!
    expect(at(london.kickoffAt, { weekday: 'long', hour: 'numeric', minute: '2-digit' })).toBe(
      'Sunday 8:30 AM',
    )
    const minutes = (iso: string) => {
      const [h, m] = at(iso, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .split(':')
        .map(Number)
      return h! * 60 + m!
    }
    const earliest = season.games
      .filter((g) => g.week <= 4)
      .sort((a, b) => minutes(a.kickoffAt) - minutes(b.kickoffAt))[0]!
    expect(earliest.id).toBe(london.id)
    const det = week4.find((g) => g.awayTeamId === 'DET' && g.homeTeamId === 'CAR')!
    expect(at(det.kickoffAt, { weekday: 'long', hour: 'numeric' })).toMatch(/^Sunday [6-8] PM$/)
    const atl = week4.find((g) => g.awayTeamId === 'ATL' && g.homeTeamId === 'NO')!
    expect(at(atl.kickoffAt, { weekday: 'long' })).toBe('Monday')
  })

  it('“Seattle had won twelve straight … Atlanta had just lost 34–3 and then won 35–14 … The Bears … won by twenty”', () => {
    expect(winnerOf('2026-w03-SEA-at-WAS')).toBe('WAS')
    expect(FINALS['2026-w02-CAR-at-ATL']).toEqual([34, 3])
    expect(FINALS['2026-w03-ATL-at-GB']).toEqual([35, 14])
    const [phi, chi] = FINALS['2026-w03-PHI-at-CHI']!
    expect(chi - phi).toBe(20)
  })

  it('“before 7:10 PM tonight, Thursday … seven of you have exactly one”', () => {
    const opener = [...week4].sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))[0]!
    const lock = new Date(new Date(opener.kickoffAt).getTime() - 5 * 60_000)
    const central = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      weekday: 'long',
      hour: 'numeric',
      minute: '2-digit',
    }).format(lock)
    expect(central).toBe('Thursday 7:10 PM')
    expect(onLives(1)).toHaveLength(7)
  })
})
