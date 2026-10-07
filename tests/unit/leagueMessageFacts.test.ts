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
const WEEK = 4
const picks = picksIn(WEEK)
const lives = livesAfter(WEEK)
const onLives = (n: number) =>
  [...lives.entries()]
    .filter(([, l]) => l === n)
    .map(([name]) => name.split(' ')[0]!)
    .sort()
const count = (teamId: string) => picks.filter((p) => p.teamId === teamId).length
const whoOn = (teamId: string) =>
  picks
    .filter((p) => p.teamId === teamId)
    .map((p) => nameOf(p.playerId).split(' ')[0]!)
    .sort()

const note = readFileSync(
  new URL('../../src/features/league-home/LeagueMessage.tsx', import.meta.url),
  'utf8',
)
const body = note.slice(note.indexOf('const WEEK_4_REVIEW'), note.indexOf('const NOTES'))

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

describe('the week 4 review gives away nothing about week 5', () => {
  it('mentions week 5 picks only to ask for them', () => {
    expect(body.match(/week 5 pick/gi) ?? []).toHaveLength(1)
    expect(body).toMatch(/DM me your week 5 pick on Teams/)
  })

  it('never names a player in the same sentence as their week 5 team, as picks arrive', () => {
    expect(teamWords.size).toBe(32)
    for (const pick of picksIn(WEEK + 1)) {
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
})

describe('the commissioner’s week 4 review states only true things', () => {
  it('“nobody in this league touched Monday night’s game”', () => {
    const monday = season.games
      .filter((g) => g.week === WEEK)
      .sort((a, b) => b.kickoffAt.localeCompare(a.kickoffAt))[0]!
    expect([monday.awayTeamId, monday.homeTeamId]).toEqual(['ATL', 'NO'])
    expect(picks.filter((p) => p.gameId === monday.id)).toHaveLength(0)
    // Every game that was picked has its final pinned, so the week is settled for the league.
    expect(picks.every((p) => p.gameId in FINALS)).toBe(true)
  })

  it('“Sixteen … Minnesota … 15–10 … Eight … Baltimore, 24–18 … Dave and Craig … Chicago, 23–12 … twenty-six of you are fine”', () => {
    expect(count('MIN')).toBe(16)
    expect(FINALS['2026-w04-MIA-at-MIN']).toEqual([10, 15])
    expect(count('BAL')).toBe(8)
    expect(FINALS['2026-w04-TEN-at-BAL']).toEqual([18, 24])
    expect(whoOn('CHI')).toEqual(['Craig', 'Dave'])
    expect(FINALS['2026-w04-NYJ-at-CHI']).toEqual([12, 23])
    expect(picks.filter((p) => !lost(p))).toHaveLength(26)
  })

  it('“Dominic also took Baltimore … had already used the Ravens in week 1” — recorded as a miss', () => {
    expect(pickOf('Dominic Green', 1)?.teamId).toBe('BAL')
    expect(pickOf('Dominic Green', WEEK)).toBeNull()
    expect(lives.get('Dominic Green')).toBe(2)
  })

  it('“Phyllis … Pittsburgh … lost 27–24 … Tina … Buffalo … 29–26 … Both are down to one life”', () => {
    expect(pickOf('Phyllis Collins', WEEK)?.teamId).toBe('PIT')
    expect(FINALS['2026-w04-PIT-at-CLE']).toEqual([24, 27])
    expect(pickOf('Tina Bush', WEEK)?.teamId).toBe('BUF')
    expect(FINALS['2026-w04-NE-at-BUF']).toEqual([29, 26])
    expect(record('BUF')).toBe('3-1')
    expect(lives.get('Phyllis Collins')).toBe(1)
    expect(lives.get('Tina Bush')).toBe(1)
  })

  it('“Don took Detroit on Sunday night in Carolina on his last life … 32–26 … first … to lose all three … by seven, two and six”', () => {
    expect(livesAfter(WEEK - 1).get('Don Turner')).toBe(1)
    const don = pickOf('Don Turner', WEEK)!
    expect(don.teamId).toBe('DET')
    expect(gamesById.get(don.gameId)?.homeTeamId).toBe('CAR')
    expect(FINALS['2026-w04-DET-at-CAR']).toEqual([26, 32])
    expect(FINALS['2026-w01-CHI-at-CAR']).toEqual([59, 37])
    expect(onLives(0)).toEqual(['Don'])
    for (const w of [1, 2, 3])
      expect(onLives(0).length === 0 || livesAfter(w).get('Don Turner')! > 0).toBe(true)
    const margins = [2, 3, 4].map((w) => {
      const p = pickOf('Don Turner', w)!
      const g = gamesById.get(p.gameId)!
      const [away, home] = FINALS[p.gameId]!
      return p.teamId === g.homeTeamId ? away - home : home - away
    })
    expect(margins).toEqual([7, 2, 6])
  })

  it('“twenty-nine alive. Seven on three lives (…), fourteen on two, and eight on one: …”', () => {
    expect([...lives.values()].filter((l) => l > 0)).toHaveLength(29)
    expect(onLives(3)).toEqual(['Allison', 'Cindy', 'Jason', 'Mike', 'Shahid', 'Tracy', 'Wesley'])
    expect(onLives(2)).toHaveLength(14)
    expect(onLives(1)).toEqual([
      'Corey',
      'Craig',
      'Jared',
      'Joanna',
      'Joseph',
      'Nate',
      'Phyllis',
      'Tina',
    ])
  })

  it('“Week 5 has byes: Carolina and Kansas City … Tampa Bay at Dallas … London at 8:30 … Minnesota, 4–0 … spent for sixteen; Kansas City … for twenty”', () => {
    const week5 = season.games.filter((g) => g.week === 5)
    const playing = new Set(week5.flatMap((g) => [g.homeTeamId, g.awayTeamId]))
    expect(playing.size).toBe(30)
    expect(playing.has('CAR')).toBe(false)
    expect(playing.has('KC')).toBe(false)
    const at = (iso: string, opts: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', ...opts }).format(
        new Date(iso),
      )
    const opener = [...week5].sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))[0]!
    expect([opener.awayTeamId, opener.homeTeamId]).toEqual(['TB', 'DAL'])
    const lock = new Date(new Date(opener.kickoffAt).getTime() - 5 * 60_000)
    expect(at(lock.toISOString(), { weekday: 'long', hour: 'numeric', minute: '2-digit' })).toBe(
      'Thursday 7:10 PM',
    )
    const london = week5.find((g) => g.awayTeamId === 'PHI' && g.homeTeamId === 'JAX')!
    expect(at(london.kickoffAt, { weekday: 'long', hour: 'numeric', minute: '2-digit' })).toBe(
      'Sunday 8:30 AM',
    )
    expect(record('MIN')).toBe('4-0')
    const spent = (teamId: string) =>
      new Set(
        season.picks.filter((p) => p.week <= WEEK && p.teamId === teamId).map((p) => p.playerId),
      ).size
    expect(spent('MIN')).toBe(16)
    expect(spent('KC')).toBe(20)
    expect(onLives(1)).toHaveLength(8)
  })
})
