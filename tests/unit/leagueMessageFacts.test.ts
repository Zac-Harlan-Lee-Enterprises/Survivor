import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  FINALS,
  crowd,
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
 * The commissioner's note states facts about the league to the people they are
 * about, so every one of them is asserted here against the season: the
 * pinned finals and scoring plays, and the recorded picks. Death's habits are
 * the only fiction in it. When these fail, the note needs rewriting — that is
 * the signal working, not a broken test.
 */
const WEEK = 8
const picks = picksIn(WEEK)
/** Lives going into week 8: nothing of week 8 has been played. */
const after = livesAfter(WEEK - 1)
const firstNames = (names: string[]) => names.map((n) => n.split(' ')[0]!).sort()
const onLives = (n: number) =>
  firstNames([...after.entries()].filter(([, l]) => l === n).map(([name]) => name))
const alive = season.profiles.filter((p) => after.get(p.displayName)! > 0)
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
const top = (week: number) => {
  const counts = new Map<string, number>()
  for (const p of picksIn(week)) counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1)
  const most = Math.max(...counts.values())
  return [...counts.entries()].filter(([, n]) => n === most)
}
const allTeams = [...new Set(season.games.flatMap((g) => [g.homeTeamId, g.awayTeamId]))]

const source = readFileSync(
  new URL('../../src/features/league-home/LeagueMessage.tsx', import.meta.url),
  'utf8',
)
const body = source.slice(source.indexOf('const WEEK_8_PREVIEW'), source.indexOf('export function'))

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

describe('the week 8 preview gives away nothing about week 8', () => {
  it('never names a player in the same sentence as the team they have picked for week 8', () => {
    expect(teamNames.size).toBe(32)
    expect(picks).toHaveLength(5)
    const sentences = body.split(/(?<=[.!?])\s+/)
    for (const p of picks) {
      const first = nameOf(p.playerId).split(' ')[0]!
      for (const s of sentences.filter((x) => new RegExp(`\\b${first}\\b`).test(x))) {
        for (const n of teamNames.get(p.teamId)!) {
          expect(new RegExp(`\\b${n}\\b`).test(s), `${first} beside ${n}: “${s}”`).toBe(false)
        }
      }
    }
  })

  it('says nothing about how the commissioner chased anyone for a pick, or when anyone sent one', () => {
    expect(body).not.toMatch(/\b(messag|nudg|remind|chas)\w*/i)
    for (const p of picks) {
      const first = nameOf(p.playerId).split(' ')[0]!
      for (const s of body.split(/(?<=[.!?])\s+/).filter((x) => x.includes(first)))
        expect(s, s).not.toMatch(/\b(sent|late|early|\d:\d\d|o’clock)\b/i)
    }
  })

  it('states no week 8 score: the only scores are ones already final', () => {
    const scores = [...body.matchAll(/\b\d+–\d+\b/g)].map((m) => m[0])
    expect(scores.sort()).toEqual(['31–7', '5–2', '6–0'])
  })

  it('every claim tested below is in the note word for word', () => {
    for (const phrase of [
      'For the first time since week 5, every one of you still standing got a pick in',
      'There are twenty-five of them now',
      'The field: five of you. Four on your last life, and Cindy on two',
      'Last week everyone who had company lost a life, and the most popular pick has now lost three weeks running, zero for forty',
      'Houston, who buried four of you last week, have the week off, along with New Orleans, the Giants and San Francisco',
      'Thursday night, Carolina at Green Bay locked the week',
      'Minnesota take the league’s last unbeaten record, 6–0, into Detroit',
      'Monday night the Bears, 5–2, play in Seattle. Joey was buried in week 5, the same weekend the Bears lost 31–7 at Green Bay, and they haven’t lost since',
      'Week 9: DM me your pick on Teams before 7:10 PM Thursday, November 5. A missing pick still costs a life',
    ])
      expect(body).toContain(phrase)
  })

  it('never says how many share a team, or who is alone', () => {
    expect(body).not.toMatch(/\b(alone|same team|together|both|two of you|three of you)\b/i)
  })
})

describe('the commissioner’s week 8 preview states only true things', () => {
  it('“For the first time since week 5, every one of you still standing got a pick in … twenty-five of them now”', () => {
    const missing = (w: number) =>
      season.profiles
        .filter((p) => livesAfter(w - 1).get(p.displayName)! > 0 && !pickOf(p.displayName, w))
        .map((p) => p.displayName)
    expect(missing(5)).toEqual([])
    expect(missing(6).filter((n) => n !== 'Zac Harlan')).toEqual(['Wesley Childers'])
    expect(missing(7)).toEqual(['Wesley Childers'])
    expect(missing(8)).toEqual([])
    expect(after.get('Wesley Childers')).toBe(0)
    expect([...after.values()].filter((l) => l === 0)).toHaveLength(25)
  })

  it('“The field: five of you. Four on your last life, and Cindy on two”', () => {
    expect([...after.values()].filter((l) => l === 0)).toHaveLength(25)
    expect(alive).toHaveLength(5)
    expect(onLives(1)).toHaveLength(4)
    expect(onLives(2)).toEqual(['Cindy'])
  })

  it('“Last week everyone who had company lost a life, and the most popular pick has now lost three weeks running, zero for forty”', () => {
    let n = 0
    for (const w of [5, 6, 7]) {
      const [[team, count]] = top(w) as [[string, number]]
      expect(top(w)).toHaveLength(1)
      expect(
        picksIn(w)
          .filter((p) => p.teamId === team)
          .every(lost),
      ).toBe(true)
      n += count
    }
    expect(n).toBe(40)
    const [[team4]] = top(4) as [[string, number]]
    expect(
      picksIn(4)
        .filter((p) => p.teamId === team4)
        .some(lost),
    ).toBe(false)
    for (const p of picksIn(7).filter((x) => crowd(7, x.teamId) > 1)) expect(lost(p)).toBe(true)
  })

  it('“Houston, who buried four of you last week, have the week off”', () => {
    const buried = season.profiles.filter(
      (p) => livesAfter(6).get(p.displayName)! > 0 && after.get(p.displayName) === 0,
    )
    expect(buried.filter((p) => pickOf(p.displayName, 7)?.teamId === 'HOU')).toHaveLength(4)
  })

  it('“Thursday night, Carolina at Green Bay locked the week”', () => {
    expect(week(WEEK)[0]!.id).toBe('2026-w08-CAR-at-GB')
    expect(at(week(WEEK)[0]!.kickoffAt)).toMatch(/^Thursday/)
  })

  it('“Minnesota take the league’s last unbeaten record, 6–0, into Detroit. Houston, New Orleans, the Giants and San Francisco are on bye”', () => {
    expect(week(WEEK).find((g) => g.awayTeamId === 'MIN')?.homeTeamId).toBe('DET')
    expect(at(week(WEEK).find((g) => g.awayTeamId === 'MIN')!.kickoffAt)).toMatch(/^Sunday/)
    expect(allTeams.filter((t) => /^\d+-0$/.test(record(t, 7)))).toEqual(['MIN'])
    expect(record('MIN', 7)).toBe('6-0')
    const playing = new Set(week(WEEK).flatMap((g) => [g.homeTeamId, g.awayTeamId]))
    expect(allTeams.filter((t) => !playing.has(t)).sort()).toEqual(['HOU', 'NO', 'NYG', 'SF'])
  })

  it('“Monday night the Bears, 5–2, play in Seattle. Joey was buried in week 5, the same weekend the Bears lost 31–7 at Green Bay, and they haven’t lost since”', () => {
    const mnf = week(WEEK).at(-1)!
    expect(mnf.id).toBe('2026-w08-CHI-at-SEA')
    expect(at(mnf.kickoffAt)).toMatch(/^Monday/)
    expect(record('CHI', 7)).toBe('5-2')
    expect(livesAfter(4).get('Joseph Tomczuk')).toBeGreaterThan(0)
    expect(livesAfter(5).get('Joseph Tomczuk')).toBe(0)
    expect(FINALS['2026-w05-CHI-at-GB']).toEqual([7, 31])
    expect(winnerOf('2026-w05-CHI-at-GB')).toBe('GB')
    expect(record('CHI', 5)).toBe('3-2')
  })

  it('“Week 9: DM me your pick on Teams before 7:10 PM Thursday, November 5. A missing pick still costs a life”', () => {
    expect(at(lockOf(9).toISOString())).toBe('Thursday, November 5 at 7:10 PM')
  })
})
