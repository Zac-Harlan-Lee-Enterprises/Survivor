import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BOX,
  FINALS,
  PLAYS,
  SCORING,
  TURNOVERS,
  livesAfter,
  lost,
  nameOf,
  picksIn,
  pinnedThrough,
  record,
  season,
  winnerOf,
} from './seasonFacts'

/**
 * The commissioner's note states facts about the league to the people they are
 * about, so every one of them is asserted here against the season: the
 * pinned finals and scoring plays, and the recorded picks. Death's habits are
 * the only fiction in it. When these fail, the note needs rewriting — that is
 * the signal working, not a broken test.
 *
 * Week 9's review went up once Sunday night settled the week, before any week
 * 10 pick.
 */
const WEEK = 9
const before = livesAfter(WEEK - 1)
const after = livesAfter(WEEK)
const alive = season.profiles.filter((p) => after.get(p.displayName)! > 0)
const firstNames = (names: string[]) => names.map((n) => n.split(' ')[0]!).sort()
const onLives = (n: number) =>
  firstNames([...after.entries()].filter(([, l]) => l === n).map(([name]) => name))
const on = (w: number, team: string) =>
  firstNames(
    picksIn(w)
      .filter((p) => p.teamId === team)
      .map((p) => nameOf(p.playerId)),
  )
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
const lostIn = (w: number) => {
  const b = livesAfter(w - 1)
  let n = 0
  for (const [name, l] of livesAfter(w)) n += b.get(name)! - l
  return n
}
/** A team's game in a week. */
const gameOf = (w: number, team: string) =>
  week(w).find((g) => g.homeTeamId === team || g.awayTeamId === team) ?? null

const source = readFileSync(
  new URL('../../src/features/league-home/LeagueMessage.tsx', import.meta.url),
  'utf8',
)
const body = source.slice(source.indexOf('const WEEK_9_REVIEW'), source.indexOf('export function'))

describe('the commissioner’s week 9 review states only true things', () => {
  it('is written from a settled week: every week 9 pick has its final', () => {
    expect(pinnedThrough).toBe(WEEK)
  })

  it('“For the second week running nobody in the league lost a life; before last week it had not happened once all season. That is ten picks in a row”', () => {
    expect(lostIn(9)).toBe(0)
    expect(lostIn(8)).toBe(0)
    for (let w = 1; w < 8; w++) expect(lostIn(w), `week ${w}`).toBeGreaterThan(0)
    expect(picksIn(8).length + picksIn(9).length).toBe(10)
    expect([...picksIn(8), ...picksIn(9)].filter(lost)).toEqual([])
  })

  it('“There are still twenty-five headstones”', () => {
    expect([...after.values()].filter((l) => l === 0)).toHaveLength(25)
  })

  it('“Dominic and Melanie, both on their last life, took the Bears at home to Tampa Bay on Sunday night”', () => {
    expect(on(WEEK, 'CHI')).toEqual(['Dominic', 'Melanie'])
    expect(before.get('Dominic Green')).toBe(1)
    expect(before.get('Melanie Moeller')).toBe(1)
    const g = gameOf(WEEK, 'CHI')!
    expect(g.id).toBe('2026-w09-TB-at-CHI')
    expect(at(g.kickoffAt)).toMatch(/^Sunday/)
    expect(winnerOf(g.id)).toBe('CHI')
  })

  it('“Caleb Williams threw four interceptions. The Bears turned it over five times. They led by eight with under four minutes left, fumbled it away at their own 21, and Tampa Bay scored and ran in the two-point conversion to tie it at 24 with 2:51 to go. Then Cairo Santos kicked a 38-yard field goal with no time left on the clock, and the Bears won 27–24”', () => {
    const id = '2026-w09-TB-at-CHI'
    expect(BOX[id]!.players['Caleb Williams']!.interceptions).toBe(4)
    expect(TURNOVERS[id]!.CHI).toBe(5)
    const fumble = PLAYS[id]![0]!
    expect(fumble[0]).toBe(4)
    expect(fumble[1]).toBe('3:48')
    expect(fumble[2]).toMatch(/FUMBLES .*RECOVERED by TB-.* at CHI 21\.$/)
    const plays = SCORING[id]!
    const secs = (clock: string) => {
      const [m, sec] = clock.split(':').map(Number)
      return m! * 60 + sec!
    }
    // The last score before the fumble at 3:48 of the fourth.
    const lead = plays.filter((p) => p[0] < 4 || secs(p[1]) > secs('3:48')).at(-1)!
    expect(lead[3][1] - lead[3][0]).toBe(8)
    const tie = plays.at(-2)!
    expect(tie).toEqual([
      4,
      '2:51',
      'TB',
      [24, 24],
      'Bucky Irving 6 Yd Rush (Baker Mayfield Run for Two-Point Conversion)',
    ])
    expect(plays.at(-1)).toEqual([4, '0:00', 'CHI', [24, 27], 'Cairo Santos 38 Yd Field Goal'])
    expect(FINALS[id]).toEqual([24, 27])
  })

  it('“Cindy and Tracy took Detroit at Miami, and Detroit won 19–9 in a game with one touchdown in it”', () => {
    expect(on(WEEK, 'DET')).toEqual(['Cindy', 'Tracy'])
    expect(FINALS['2026-w09-DET-at-MIA']).toEqual([19, 9])
    const plays = SCORING['2026-w09-DET-at-MIA']!
    expect(plays.at(-1)![3]).toEqual([19, 9])
    expect(plays.filter((p) => !/Field Goal/.test(p[4]))).toHaveLength(1)
  })

  it('“Jake Bates kicked four field goals from four tries and scored thirteen points … beat the Dolphins on his own. Miami never found the end zone”', () => {
    const bates = BOX['2026-w09-DET-at-MIA']!.players['Jake Bates']!
    expect(bates.fieldGoals).toEqual([4, 4])
    expect(bates.points).toBe(13)
    expect(bates.points!).toBeGreaterThan(FINALS['2026-w09-DET-at-MIA']![1])
    const miami = SCORING['2026-w09-DET-at-MIA']!.filter((p) => p[2] === 'MIA')
    expect(miami.every((p) => /Field Goal/.test(p[4]))).toBe(true)
    expect(BOX['2026-w09-DET-at-MIA']!.teams.MIA!.redZone[0]).toBe(0)
  })

  it('“Cindy has now picked a winner in eight of her nine weeks and is still the only one of you on two lives”', () => {
    const cindy = season.picks.filter((p) => p.playerId === 'cindy-mendoza' && p.week <= WEEK)
    expect(cindy).toHaveLength(9)
    expect(cindy.filter((p) => !lost(p))).toHaveLength(8)
    expect(onLives(2)).toEqual(['Cindy'])
  })

  it('“Allison took San Francisco at home to Las Vegas and won 38–17. The Raiders turned it over five times, and seventeen seconds into the second half Jaden Dugger intercepted Kirk Cousins and ran it back 35 yards for a touchdown. The 49ers are 7–1”', () => {
    expect(on(WEEK, 'SF')).toEqual(['Allison'])
    expect(FINALS['2026-w09-LV-at-SF']).toEqual([17, 38])
    expect(TURNOVERS['2026-w09-LV-at-SF']!.LV).toBe(5)
    const pick6 = SCORING['2026-w09-LV-at-SF']!.find((p) => /Interception Return/.test(p[4]))!
    expect(pick6[0]).toBe(3)
    expect(pick6[1]).toBe('14:43')
    expect(pick6[4]).toMatch(/^Jaden Dugger 35 Yd Interception Return/)
    expect(record('SF', WEEK)).toBe('7-1')
  })

  it('“Cincinnati, whom every one of you has already used, won 34–17 at Atlanta at 8:30 in the morning”', () => {
    expect(FINALS['2026-w09-CIN-at-ATL']).toEqual([34, 17])
    expect(at(gameOf(WEEK, 'CIN')!.kickoffAt)).toBe('Sunday, November 8 at 8:30 AM')
    for (const p of alive)
      expect(
        season.picks.some((x) => x.playerId === p.playerId && x.week <= WEEK && x.teamId === 'CIN'),
        p.displayName,
      ).toBe(true)
  })

  it('“Nobody picked Buffalo at Minnesota, so the week was settled when the Bears’ game ended”', () => {
    const mnf = week(WEEK).at(-1)!
    expect(mnf.id).toBe('2026-w09-BUF-at-MIN')
    expect(at(mnf.kickoffAt)).toMatch(/^Monday/)
    expect(picksIn(WEEK).filter((p) => p.gameId === mnf.id)).toEqual([])
    const sunday = week(WEEK).filter((g) => g.id !== mnf.id)
    expect(sunday.at(-1)!.id).toBe('2026-w09-TB-at-CHI')
  })

  it('“Week 10: Chicago, Denver, Philadelphia and Tampa Bay are on bye … Thursday night is Washington at the Giants, which locks the week, and Sunday starts at 8:30 in the morning again, with New England at Detroit; Cindy and Tracy can’t have the Lions twice”', () => {
    const playing = new Set(week(10).flatMap((g) => [g.homeTeamId, g.awayTeamId]))
    expect(allTeams.filter((t) => !playing.has(t)).sort()).toEqual(['CHI', 'DEN', 'PHI', 'TB'])
    expect(week(10)[0]!.id).toBe('2026-w10-WAS-at-NYG')
    expect(at(week(10)[0]!.kickoffAt)).toMatch(/^Thursday/)
    const sunday = week(10).filter((g) => at(g.kickoffAt).startsWith('Sunday'))
    expect(sunday[0]!.id).toBe('2026-w10-NE-at-DET')
    expect(at(sunday[0]!.kickoffAt)).toBe('Sunday, November 15 at 8:30 AM')
  })

  it('“Five of you, four on your last life, Cindy on two”', () => {
    expect(alive).toHaveLength(5)
    expect(onLives(1)).toEqual(['Allison', 'Dominic', 'Melanie', 'Tracy'])
  })

  it('“DM me your week 10 pick on Teams before 7:10 PM Thursday, November 12, five minutes before Washington at the Giants kicks off”', () => {
    expect(at(lockOf(10).toISOString())).toBe('Thursday, November 12 at 7:10 PM')
    expect(at(week(10)[0]!.kickoffAt)).toBe('Thursday, November 12 at 7:15 PM')
  })

  it('knows no week 10 team: picks before the lock are recorded sealed, so the note cannot leak one', () => {
    expect(picksIn(10)).toEqual([])
  })

  it('says nothing of messages or pick times', () => {
    expect(body).not.toMatch(/\b(messag|nudg|remind|chas)\w*/i)
    expect(body.replaceAll('late commissioner', '')).not.toMatch(/\b(sent|submitted|early|late)\b/i)
  })
})
