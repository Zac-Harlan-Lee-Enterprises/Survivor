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
 * Every week 1 and week 2 final, as the ESPN scoreboard
 * reports them (site.api.espn.com, 2026 season type 2, weeks 1 and 2, read on
 * 2026-09-22). The seed deliberately carries no results — the app fetches them
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
}

const WEEK = 3
const gamesById = new Map(season.games.map((g) => [g.id, g]))

const winnerOf = (gameId: string) => {
  const game = gamesById.get(gameId)
  const final = FINALS[gameId]
  if (!game || !final) throw new Error(`no final pinned for ${gameId}`)
  const [away, home] = final
  return away > home ? game.awayTeamId : game.homeTeamId
}

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

const note = readFileSync(
  new URL('../../src/features/league-home/LeagueMessage.tsx', import.meta.url),
  'utf8',
)

describe('the commissioner’s week 3 preview states only true things', () => {
  it('names nobody: picks are hidden until the first kickoff, so the preview may not hint at them', () => {
    const body = note.slice(note.indexOf('const WEEK_3_PREVIEW'), note.indexOf('const NOTES'))
    for (const { displayName } of season.profiles) {
      const first = displayName.split(' ')[0]!
      // "KC" is also a team abbreviation; the note never uses the abbreviation.
      expect(body, `the preview mentions ${displayName}`).not.toMatch(new RegExp(`\\b${first}\\b`))
    }
    expect(body).not.toMatch(/\b(picked|are on|is on)\b/i)
  })

  it('“Week 3 locks at 7:10 tonight” — Thursday, five minutes before Atlanta at Green Bay, Central time', () => {
    const opener = season.games
      .filter((g) => g.week === WEEK)
      .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))[0]!
    expect([opener.awayTeamId, opener.homeTeamId]).toEqual(['ATL', 'GB'])
    const lock = new Date(new Date(opener.kickoffAt).getTime() - 5 * 60_000)
    const central = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      weekday: 'long',
      hour: 'numeric',
      minute: '2-digit',
    }).format(lock)
    expect(central).toBe('Thursday 7:10 PM')
  })

  it('“Three of you found out last week what a missing pick costs”', () => {
    const answered = new Set(season.picks.filter((p) => p.week === 2).map((p) => p.playerId))
    expect(season.profiles.filter((p) => !answered.has(p.playerId))).toHaveLength(3)
  })

  it('“Kansas City are 2–0 and visit Miami, who have scored exactly thirteen … in each of their two games”', () => {
    const week3 = season.games.filter((g) => g.week === WEEK)
    expect(week3.some((g) => g.awayTeamId === 'KC' && g.homeTeamId === 'MIA')).toBe(true)
    expect(record('KC')).toBe('2-0')
    const miami = Object.entries(FINALS)
      .filter(([id]) => id.includes('MIA'))
      .map(([id, [away, home]]) => (gamesById.get(id)?.awayTeamId === 'MIA' ? away : home))
    expect(miami).toEqual([13, 13])
  })

  it('“Seattle … 2–0 … visit Washington. Washington are 0–2 … this is their home opener”', () => {
    const week3 = season.games.filter((g) => g.week === WEEK)
    expect(week3.some((g) => g.awayTeamId === 'SEA' && g.homeTeamId === 'WAS')).toBe(true)
    expect(record('SEA')).toBe('2-0')
    expect(record('WAS')).toBe('0-2')
    expect(season.games.filter((g) => g.week < WEEK && g.homeTeamId === 'WAS')).toHaveLength(0)
  })

  it('“The Chargers visit Buffalo … 26–14 in each … Buffalo scored forty-one … Seven of you used the Chargers in week 1”', () => {
    const week3 = season.games.filter((g) => g.week === WEEK)
    expect(week3.some((g) => g.awayTeamId === 'LAC' && g.homeTeamId === 'BUF')).toBe(true)
    expect(FINALS['2026-w01-ARI-at-LAC']).toEqual([26, 14])
    expect(FINALS['2026-w02-LV-at-LAC']).toEqual([26, 14])
    expect(FINALS['2026-w02-DET-at-BUF']![1]).toBe(41)
    expect(season.picks.filter((p) => p.week === 1 && p.teamId === 'LAC')).toHaveLength(7)
  })

  it('“Atlanta lost 34–3 at home to Carolina … Green Bay beat the Jets by three”', () => {
    expect(FINALS['2026-w02-CAR-at-ATL']).toEqual([34, 3])
    const [gb, nyj] = FINALS['2026-w02-GB-at-NYJ']!
    expect(gb - nyj).toBe(3)
  })

  it('“the eleven of you who rode San Francisco last week, the seven on Tampa Bay”', () => {
    const week2 = season.picks.filter((p) => p.week === 2)
    expect(week2.filter((p) => p.teamId === 'SF')).toHaveLength(11)
    expect(week2.filter((p) => p.teamId === 'TB')).toHaveLength(7)
  })
})
