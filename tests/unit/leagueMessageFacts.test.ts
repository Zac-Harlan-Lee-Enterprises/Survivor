import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  FINALS,
  gamesById,
  livesAfter,
  lost,
  nameOf,
  pickOf,
  picksIn,
  record,
  season,
  winnerOf,
} from './seasonFacts'

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
 * The season and its pinned finals live in ./seasonFacts, shared with the
 * headstones' epitaph test.
 */
const WEEK = 3
const picks = picksIn(WEEK)
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
