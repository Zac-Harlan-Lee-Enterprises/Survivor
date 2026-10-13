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
const WEEK = 5
const picks = picksIn(WEEK)
const before = livesAfter(WEEK - 1)
const after = livesAfter(WEEK)
const whoOn = (teamId: string) =>
  picks
    .filter((p) => p.teamId === teamId)
    .map((p) => nameOf(p.playerId).split(' ')[0]!)
    .sort()
const first = (names: string[]) => names.map((n) => n.split(' ')[0]!).sort()
const onLives = (n: number) =>
  first([...after.entries()].filter(([, l]) => l === n).map(([name]) => name))
/** Points a team scored in a pinned final. */
const pointsFor = (gameId: string, teamId: string) => {
  const g = gamesById.get(gameId)!
  const [away, home] = FINALS[gameId]!
  return g.homeTeamId === teamId ? home : away
}

const note = readFileSync(
  new URL('../../src/features/league-home/LeagueMessage.tsx', import.meta.url),
  'utf8',
)
const body = note.slice(note.indexOf('const WEEK_5_REVIEW'), note.indexOf('const NOTES'))

describe('the week 5 review gives away nothing about week 6', () => {
  it('mentions week 6 picks only to ask for them', () => {
    expect(body.match(/week 6 pick/gi) ?? []).toHaveLength(1)
    expect(body).toMatch(/DM me your week 6 pick on Teams/)
  })
})

describe('the commissioner’s week 5 review states only true things', () => {
  it('“Twenty-one of you rode Dallas … Tampa Bay, 0–4 … won 24–16 … every one of the twenty-one lost a life”', () => {
    const dallas = picks.filter((p) => p.teamId === 'DAL')
    expect(dallas).toHaveLength(21)
    expect(FINALS['2026-w05-TB-at-DAL']).toEqual([24, 16])
    expect(dallas.every(lost)).toBe(true)
    const tbBefore = Object.entries(FINALS).filter(
      ([id]) => id.includes('TB') && !id.startsWith('2026-w05'),
    )
    expect(tbBefore.every(([id]) => winnerOf(id) !== 'TB')).toBe(true)
    expect(tbBefore).toHaveLength(4)
  })

  it('“Craig, Jared, Joey, Nate and Phyllis are out. With Don, that is six graves”', () => {
    expect(onLives(0)).toEqual(['Craig', 'Don', 'Jared', 'Joseph', 'Nate', 'Phyllis'])
    const outThisWeek = first(
      [...after.entries()].filter(([n, l]) => l === 0 && before.get(n)! > 0).map(([n]) => n),
    )
    expect(outThisWeek).toEqual(['Craig', 'Jared', 'Joseph', 'Nate', 'Phyllis'])
  })

  it('“the Bears lost 31–7 at Green Bay”', () => {
    expect(FINALS['2026-w05-CHI-at-GB']).toEqual([7, 31])
  })

  it('“Washington tied the Giants 27–27, and a tie costs a life” — Paul’s pick', () => {
    expect(whoOn('WAS')).toEqual(['Paul'])
    expect(FINALS['2026-w05-NYG-at-WAS']).toEqual([27, 27])
    expect(winnerOf('2026-w05-NYG-at-WAS')).toBeNull()
    expect(after.get('Paul Lim')).toBe(before.get('Paul Lim')! - 1)
  })

  it('“Cindy, Dave, Melanie and Allison survived Cincinnati 31–24 — Miami scored twenty-four, nearly double its previous season high”', () => {
    expect(whoOn('CIN')).toEqual(['Allison', 'Cindy', 'Dave', 'Melanie'])
    expect(FINALS['2026-w05-CIN-at-MIA']).toEqual([31, 24])
    const earlier = Object.keys(FINALS)
      .filter((id) => id.includes('MIA') && !id.startsWith('2026-w05'))
      .map((id) => pointsFor(id, 'MIA'))
    const high = Math.max(...earlier)
    expect(high).toBe(13)
    expect(24 / high).toBeGreaterThan(1.8)
    expect(24 / high).toBeLessThan(2)
  })

  it('“Joanna and Corey took Houston, who won their first game of the season 26–3”', () => {
    expect(whoOn('HOU')).toEqual(['Corey', 'Joanna'])
    expect(FINALS['2026-w05-HOU-at-TEN']).toEqual([26, 3])
    const earlier = Object.keys(FINALS).filter(
      (id) => id.includes('HOU') && !id.startsWith('2026-w05'),
    )
    expect(earlier.every((id) => winnerOf(id) !== 'HOU')).toBe(true)
  })

  it('“Tina took New England, who beat the Raiders 45–17”', () => {
    expect(whoOn('NE')).toEqual(['Tina'])
    expect(FINALS['2026-w05-LV-at-NE']).toEqual([17, 45])
  })

  it('“twenty-four alive … Allison and Cindy … all three lives … neither has lost a pick … Seven … two … fifteen … last”', () => {
    expect([...after.values()].filter((l) => l > 0)).toHaveLength(24)
    expect(onLives(3)).toEqual(['Allison', 'Cindy'])
    for (const name of ['Allison Petty', 'Cindy Mendoza']) {
      expect(pickOf(name, WEEK)?.teamId).toBe('CIN')
      const theirs = season.picks.filter((p) => nameOf(p.playerId) === name)
      expect(theirs).toHaveLength(5)
      expect(theirs.some(lost)).toBe(false)
    }
    expect(onLives(2)).toHaveLength(7)
    expect(onLives(1)).toHaveLength(15)
  })

  it('“Week 6 … four teams on bye: Cincinnati, Miami, Detroit and Minnesota … Seattle at Denver … London … 8:30 … 4–1 Jacksonville … Dallas visit Green Bay on Sunday night”', () => {
    const week6 = season.games.filter((g) => g.week === 6)
    const playing = new Set(week6.flatMap((g) => [g.homeTeamId, g.awayTeamId]))
    expect(['CIN', 'MIA', 'DET', 'MIN'].every((t) => !playing.has(t))).toBe(true)
    expect(playing.size).toBe(28)
    const opener = [...week6].sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))[0]!
    expect([opener.awayTeamId, opener.homeTeamId]).toEqual(['SEA', 'DEN'])
    const at = (iso: string) =>
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago',
        weekday: 'long',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(iso))
    const london = week6.find((g) => [g.homeTeamId, g.awayTeamId].sort().join() === 'HOU,JAX')!
    expect(at(london.kickoffAt)).toBe('Sunday 8:30 AM')
    expect(record('JAX')).toBe('4-1')
    const dallas = week6.find((g) => g.awayTeamId === 'DAL')!
    expect(dallas.homeTeamId).toBe('GB')
    expect(at(dallas.kickoffAt)).toMatch(/^Sunday [7-8]:\d\d PM$/)
    const lock = new Date(new Date(opener.kickoffAt).getTime() - 5 * 60_000)
    expect(at(lock.toISOString())).toBe('Thursday 7:10 PM')
  })
})
