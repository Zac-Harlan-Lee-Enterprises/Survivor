import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SCORING, livesAfter, lost, nameOf, pickOf, picksIn, record, season } from './seasonFacts'

/**
 * The commissioner's note states facts about the league to the people they are
 * about, so every one of them is asserted here against the season: the
 * pinned finals and scoring plays, and the recorded picks. Death's habits are
 * the only fiction in it. When these fail, the note needs rewriting — that is
 * the signal working, not a broken test.
 *
 * Week 9's note went up after the lock and before the games, so it must give
 * nothing away: no team anyone picked, no pick times, no messages.
 */
const WEEK = 9
const picks = picksIn(WEEK)
/** Lives going into week 9: nothing of week 9 has been played. */
const after = livesAfter(WEEK - 1)
const alive = season.profiles.filter((p) => after.get(p.displayName)! > 0)
const firstNames = (names: string[]) => names.map((n) => n.split(' ')[0]!).sort()
const onLives = (n: number) =>
  firstNames([...after.entries()].filter(([, l]) => l === n).map(([name]) => name))
const week = (w: number) =>
  [...season.games.filter((g) => g.week === w)].sort((a, b) =>
    a.kickoffAt.localeCompare(b.kickoffAt),
  )
const lockOf = (w: number) => new Date(new Date(week(w)[0]!.kickoffAt).getTime() - 5 * 60_000)
const at = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
const allTeams = [...new Set(season.games.flatMap((g) => [g.homeTeamId, g.awayTeamId]))]
const missing = (w: number) =>
  season.profiles
    .filter((p) => livesAfter(w - 1).get(p.displayName)! > 0 && !pickOf(p.displayName, w))
    .map((p) => p.displayName)

const source = readFileSync(
  new URL('../../src/features/league-home/LeagueMessage.tsx', import.meta.url),
  'utf8',
)
const body = source.slice(source.indexOf('const WEEK_9_PREVIEW'), source.indexOf('export function'))

/** Every way the note could name a team: abbreviation, city, nickname, aliases (src/domain/teams.ts). */
const teamNames = (() => {
  const src = readFileSync(new URL('../../src/domain/teams.ts', import.meta.url), 'utf8')
  const out = new Map<string, string[]>()
  for (const m of src.matchAll(/\['([A-Z]+)', '([^']+)', '([^']+)',[^\]]*\[([^\]]*)\]\]/g)) {
    const aliases = [...m[4]!.matchAll(/'([^']+)'/g)].map((a) => a[1]!)
    out.set(m[1]!, [m[1]!, m[2]!, m[3]!, ...aliases])
  }
  return out
})()

describe('the week 9 preview gives away nothing about week 9', () => {
  it('names no team that anyone picked for week 9, in any form', () => {
    expect(teamNames.size).toBe(32)
    expect(picks).toHaveLength(5)
    for (const team of new Set(picks.map((p) => p.teamId)))
      for (const n of teamNames.get(team)!)
        expect(new RegExp(`\\b${n}\\b`).test(body), `${team} as “${n}”`).toBe(false)
  })

  it('says nothing about who shares a team, who sent a pick when, or how anyone was chased for one', () => {
    expect(body).not.toMatch(
      /\b(alone|same team|together|both|company|crowd|two of you|three of you)\b/i,
    )
    expect(body).not.toMatch(/\b(messag|nudg|remind|chas)\w*/i)
    // (“the late commissioner” is who writes it, not when anyone picked.)
    expect(body.replaceAll('late commissioner', '')).not.toMatch(/\b(sent|submitted|early|late)\b/i)
  })

  it('states no week 9 score', () => {
    const scores = [...body.matchAll(/\b\d+–\d+\b/g)].map((m) => m[0]).sort()
    expect(scores).toEqual(['1–6', '6–1'])
  })
})

describe('the commissioner’s week 9 preview states only true things', () => {
  it('“Last week nobody lost a life, for the first time all season”', () => {
    const lostIn = (w: number) => {
      const b = livesAfter(w - 1)
      let n = 0
      for (const [name, l] of livesAfter(w)) n += b.get(name)! - l
      return n
    }
    expect(lostIn(8)).toBe(0)
    for (let w = 1; w < 8; w++) expect(lostIn(w), `week ${w}`).toBeGreaterThan(0)
  })

  it('“All five week 9 picks are in … two weeks running without a missing pick for the first time all season”', () => {
    expect(alive).toHaveLength(5)
    expect(missing(9)).toEqual([])
    expect(missing(8)).toEqual([])
    for (let w = 1; w < 8; w++)
      expect(missing(w).length > 0 || missing(w + 1).length > 0, `weeks ${w}–${w + 1}`).toBe(true)
  })

  it('“five of you, four on your last life, and Cindy on two. She has picked a winner in seven of her eight weeks”', () => {
    expect(onLives(1)).toHaveLength(4)
    expect(onLives(2)).toEqual(['Cindy'])
    const cindy = season.picks.filter((p) => p.playerId === 'cindy-mendoza' && p.week <= 8)
    expect(cindy).toHaveLength(8)
    expect(cindy.filter((p) => !lost(p))).toHaveLength(7)
  })

  it('“Thursday’s Jacksonville at Baltimore locked the week. Sunday starts at 8:30 in the morning, our time, with Cincinnati at Atlanta, and every one of you has already used the Bengals”', () => {
    expect(week(WEEK)[0]!.id).toBe('2026-w09-JAX-at-BAL')
    expect(at(week(WEEK)[0]!.kickoffAt)).toMatch(/^Thursday/)
    const sunday = week(WEEK).filter((g) => at(g.kickoffAt).startsWith('Sunday'))
    expect(sunday[0]!.id).toBe('2026-w09-CIN-at-ATL')
    expect(at(sunday[0]!.kickoffAt)).toBe('Sunday, November 8 at 8:30 AM')
    for (const p of alive)
      expect(
        season.picks.some((x) => x.playerId === p.playerId && x.week < WEEK && x.teamId === 'CIN'),
        p.displayName,
      ).toBe(true)
  })

  it('“Pittsburgh and Tennessee are on bye. Tennessee came in 1–6 last week and still took Cincinnati to overtime”', () => {
    const playing = new Set(week(WEEK).flatMap((g) => [g.homeTeamId, g.awayTeamId]))
    expect(allTeams.filter((t) => !playing.has(t)).sort()).toEqual(['PIT', 'TEN'])
    expect(record('TEN', 7)).toBe('1-6')
    const plays = SCORING['2026-w08-TEN-at-CIN']!
    expect(plays.at(-1)![0]).toBe(5)
    expect(plays.at(-2)![3]).toEqual([36, 36])
  })

  it('“Monday night is Buffalo at Minnesota, now 6–1 after losing their unbeaten record last week”', () => {
    const mnf = week(WEEK).at(-1)!
    expect(mnf.id).toBe('2026-w09-BUF-at-MIN')
    expect(at(mnf.kickoffAt)).toMatch(/^Monday/)
    expect(record('MIN', 8)).toBe('6-1')
    expect(record('MIN', 7)).toBe('6-0')
  })

  it('“There are still twenty-five” headstones', () => {
    expect([...after.values()].filter((l) => l === 0)).toHaveLength(25)
  })

  it('“Week 10: DM me your pick on Teams before 7:10 PM Thursday, November 12”', () => {
    expect(at(lockOf(10).toISOString())).toBe('Thursday, November 12 at 7:10 PM')
  })

  it('the picks recorded for week 9 are the five alive, each on a team they had not used', () => {
    for (const p of picks) {
      expect(after.get(nameOf(p.playerId))!, p.playerId).toBeGreaterThan(0)
      expect(
        season.picks.some(
          (x) => x.playerId === p.playerId && x.week < WEEK && x.teamId === p.teamId,
        ),
        p.playerId,
      ).toBe(false)
      expect(new Date(p.submittedAt).getTime()).toBeLessThan(lockOf(WEEK).getTime())
    }
  })
})
