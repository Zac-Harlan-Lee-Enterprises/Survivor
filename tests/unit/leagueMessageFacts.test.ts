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
  [...season.games.filter((g) => g.week === w)].sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))
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

  it('never says how many share a team, or who is alone', () => {
    expect(body).not.toMatch(/\b(alone|same team|together|both|two of you|three of you)\b/i)
  })
})

describe('the commissioner’s week 8 preview states only true things', () => {
  it('“All five week 8 picks are in … Tracy sent hers at 12:14 on Wednesday afternoon. Allison sent hers at 5:39 on Thursday, an hour and a half before the lock”', () => {
    expect(alive).toHaveLength(5)
    expect(alive.every((p) => pickOf(p.displayName, WEEK))).toBe(true)
    const order = [...picks].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
    expect(nameOf(order[0]!.playerId)).toBe('Tracy Nelson')
    expect(at(order[0]!.submittedAt)).toBe('Wednesday, October 28 at 12:14 PM')
    expect(nameOf(order.at(-1)!.playerId)).toBe('Allison Petty')
    expect(at(order.at(-1)!.submittedAt)).toBe('Thursday, October 29 at 5:39 PM')
    const lead = lockOf(WEEK).getTime() - new Date(order.at(-1)!.submittedAt).getTime()
    expect(Math.round(lead / 60_000)).toBe(91) // 1 h 30 min 52 s
  })

  it('“after I messaged her twice in four minutes. The second message told her she had two hours. She had two hours and fifteen”', () => {
    // From the commissioner's Teams chat with Allison (read 2026-10-29): “who
    // is your pick?” at 4:51 PM and “2 hours to get your pick in!” at 4:55 PM CT.
    const second = new Date('2026-10-29T21:55:01.000Z')
    expect(at(second.toISOString())).toBe('Thursday, October 29 at 4:55 PM')
    expect(Math.floor((lockOf(WEEK).getTime() - second.getTime()) / 60_000)).toBe(2 * 60 + 14)
    expect(Math.round((lockOf(WEEK).getTime() - second.getTime()) / 60_000)).toBe(2 * 60 + 15)
  })

  it('“the first week since week 5 that everyone still standing sent a pick. Wesley sent nothing in weeks 6 and 7”', () => {
    const missing = (w: number) =>
      season.profiles
        .filter((p) => livesAfter(w - 1).get(p.displayName)! > 0 && !pickOf(p.displayName, w))
        .map((p) => p.displayName)
    expect(missing(5)).toEqual([])
    expect(missing(6).filter((n) => n !== 'Zac Harlan')).toEqual(['Wesley Childers'])
    expect(missing(7)).toEqual(['Wesley Childers'])
    expect(missing(8)).toEqual([])
    expect(after.get('Wesley Childers')).toBe(0)
  })

  it('“five of you, with twenty-five headstones behind you. Four of you are on your last life. Cindy is on two”', () => {
    expect([...after.values()].filter((l) => l === 0)).toHaveLength(25)
    expect(alive).toHaveLength(5)
    expect(onLives(1)).toHaveLength(4)
    expect(onLives(2)).toEqual(['Cindy'])
  })

  it('“The most popular pick has lost three weeks running and is zero for forty, and last week everyone who had company lost a life”', () => {
    let n = 0
    for (const w of [5, 6, 7]) {
      const [[team, count]] = top(w) as [[string, number]]
      expect(top(w)).toHaveLength(1)
      expect(picksIn(w).filter((p) => p.teamId === team).every(lost)).toBe(true)
      n += count
    }
    expect(n).toBe(40)
    const [[team4]] = top(4) as [[string, number]]
    expect(picksIn(4).filter((p) => p.teamId === team4).some(lost)).toBe(false)
    for (const p of picksIn(7).filter((x) => crowd(7, x.teamId) > 1)) expect(lost(p)).toBe(true)
  })

  it('“Carolina at Green Bay locked the week; the Panthers came in 3–3 and the Packers 4–3”', () => {
    expect(week(WEEK)[0]!.id).toBe('2026-w08-CAR-at-GB')
    expect(record('CAR', 7)).toBe('3-3')
    expect(record('GB', 7)).toBe('4-3')
  })

  it('“Minnesota take the league’s only unbeaten record, 6–0, to Detroit. Houston, New Orleans, the Giants and San Francisco are on bye”', () => {
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

  it('“Week 9: DM me your pick on Teams before 7:10 PM Thursday, November 5”', () => {
    expect(at(lockOf(9).toISOString())).toBe('Thursday, November 5 at 7:10 PM')
  })
})
