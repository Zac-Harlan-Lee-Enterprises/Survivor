import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  FINALS,
  SCORING,
  TURNOVERS,
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
const before = livesAfter(WEEK - 1)
const after = livesAfter(WEEK)
const firstNames = (names: string[]) => names.map((n) => n.split(' ')[0]!).sort()
const whoOn = (teamId: string) =>
  firstNames(picks.filter((p) => p.teamId === teamId).map((p) => nameOf(p.playerId)))
const onLives = (n: number) =>
  firstNames([...after.entries()].filter(([, l]) => l === n).map(([name]) => name))
const livesLostIn = (w: number) => {
  const b = livesAfter(w - 1)
  let n = 0
  for (const [name, l] of livesAfter(w)) n += b.get(name)! - l
  return n
}
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
const top = (w: number) => {
  const counts = new Map<string, number>()
  for (const p of picksIn(w)) counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1)
  const most = Math.max(...counts.values())
  return [...counts.entries()].filter(([, n]) => n === most)
}
const allTeams = [...new Set(season.games.flatMap((g) => [g.homeTeamId, g.awayTeamId]))]

/** What the week 8 preview (now replaced) said, which this one calls back to. */
const LAST_NOTE_SAID =
  'On Sunday, Minnesota take the league’s last unbeaten record, 6–0, into Detroit. Death has a seat on the fifty-yard line and has promised to sit on his hands.'

const source = readFileSync(
  new URL('../../src/features/league-home/LeagueMessage.tsx', import.meta.url),
  'utf8',
)
const body = source.slice(source.indexOf('const WEEK_8_REVIEW'), source.indexOf('export function'))

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

describe('the week 8 review gives away nothing about week 9', () => {
  it('never names a player in the same sentence as a team they have picked for week 9', () => {
    expect(teamNames.size).toBe(32)
    const sentences = body.split(/(?<=[.!?])\s+/)
    for (const p of picksIn(9)) {
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
    expect(body).not.toMatch(/\b(sent|submitted)\b/i)
  })

  it('mentions week 9 picks only to ask for them', () => {
    expect(body.match(/week 9 pick/gi) ?? []).toHaveLength(1)
    expect(body).toMatch(/DM me your week 9 pick on Teams/)
  })
})

describe('the commissioner’s week 8 review states only true things', () => {
  it('“Every one of you picked a winner, and for the first time this season nobody in the league lost a life — this after weeks of twenty-two, nineteen and ten … There are still twenty-five”', () => {
    expect(picks).toHaveLength(5)
    expect(picks.some(lost)).toBe(false)
    expect(livesLostIn(8)).toBe(0)
    for (let w = 1; w < 8; w++) expect(livesLostIn(w), `week ${w}`).toBeGreaterThan(0)
    expect([5, 6, 7].map(livesLostIn)).toEqual([22, 19, 10])
    expect([...after.values()].filter((l) => l === 0)).toHaveLength(25)
  })

  it('“Dominic and Tracy, both on their last life, took Cincinnati at home to Tennessee, who came in 1–6. Last week everyone who had company lost”', () => {
    expect(whoOn('CIN')).toEqual(['Dominic', 'Tracy'])
    expect(before.get('Dominic Green')).toBe(1)
    expect(before.get('Tracy Nelson')).toBe(1)
    expect(season.games.find((g) => g.id === '2026-w08-TEN-at-CIN')!.homeTeamId).toBe('CIN')
    expect(record('TEN', 7)).toBe('1-6')
    for (const p of picksIn(7).filter((x) => crowd(7, x.teamId) > 1)) expect(lost(p)).toBe(true)
  })

  it('“They fell behind 13–0. They turned it over four times. They trailed 36–29 with under four minutes left. Tee Higgins tied it with 1:17 to go, and Joe Burrow ran it in from nine yards in overtime to win 43–36”', () => {
    const plays = SCORING['2026-w08-TEN-at-CIN']!
    expect(plays.some(([, , , score]) => score.join() === '13,0')).toBe(true)
    expect(TURNOVERS['2026-w08-TEN-at-CIN']!.CIN).toBe(4)
    const behind = plays.find(([, , , score]) => score.join() === '36,29')!
    expect(behind[0]).toBe(4)
    expect(behind[1]).toBe('3:46')
    const tie = plays.find(([, , , score]) => score.join() === '36,36')!
    expect(tie.slice(0, 3)).toEqual([4, '1:17', 'CIN'])
    expect(tie[4]).toMatch(/^Tee Higgins /)
    const last = plays.at(-1)!
    expect(last[0]).toBe(5)
    expect(last[4]).toMatch(/^Joe Burrow 9 Yd Rush/)
    expect(FINALS['2026-w08-TEN-at-CIN']).toEqual([36, 43])
  })

  it('“Melanie took Jacksonville at home to Indianapolis … 35–0 in the third quarter, including a 92-yard interception return with ten seconds left in the half, and 42–7 at the end, the biggest win of the week”', () => {
    expect(whoOn('JAX')).toEqual(['Melanie'])
    expect(season.games.find((g) => g.id === '2026-w08-IND-at-JAX')!.homeTeamId).toBe('JAX')
    const plays = SCORING['2026-w08-IND-at-JAX']!
    expect(plays.find(([, , , s]) => s.join() === '0,35')![0]).toBe(3)
    const pick6 = plays.find(([, , , , t]) => /92 Yd Interception Return/.test(t))!
    expect(pick6.slice(0, 3)).toEqual([2, '0:10', 'JAX'])
    expect(FINALS['2026-w08-IND-at-JAX']).toEqual([7, 42])
    const margins = Object.entries(FINALS)
      .filter(([id]) => id.startsWith('2026-w08-'))
      .map(([id, [a, h]]) => [id, Math.abs(a - h)] as const)
      .sort((x, y) => y[1] - x[1])
    expect(margins[0]).toEqual(['2026-w08-IND-at-JAX', 35])
    expect(margins[1]![1]).toBeLessThan(35)
  })

  it('“Cindy took the Rams — the same Rams who cost thirteen of us a life in week 6 — against the Chargers, who came in 0–6. The Chargers kicked three field goals, led 9–3, and never scored again; the Rams won 24–9. Cindy is still the only one of you on two lives”', () => {
    expect(whoOn('LAR')).toEqual(['Cindy'])
    expect(top(6)).toEqual([['LAR', 13]])
    expect(
      picksIn(6)
        .filter((p) => p.teamId === 'LAR')
        .every(lost),
    ).toBe(true)
    expect(pickOf('Zac Harlan', 6)?.teamId).toBe('LAR') // “us”: the commissioner was one of them
    expect(record('LAC', 7)).toBe('0-6')
    const plays = SCORING['2026-w08-LAC-at-LAR']!
    const lac = plays.filter(([, , t]) => t === 'LAC')
    expect(lac).toHaveLength(3)
    expect(lac.every(([, , , , text]) => /Field Goal$/.test(text))).toBe(true)
    expect(lac.at(-1)![3]).toEqual([9, 3])
    expect(plays.indexOf(lac.at(-1)!)).toBe(3)
    expect(FINALS['2026-w08-LAC-at-LAR']).toEqual([9, 24])
    expect(onLives(2)).toEqual(['Cindy'])
  })

  it('“The Chargers are now 0–7. I picked them in week 1 … they were 0–0 at the time”', () => {
    expect(record('LAC', 8)).toBe('0-7')
    expect(pickOf('Zac Harlan', 1)?.teamId).toBe('LAC')
    expect(record('LAC', 0)).toBe('0-0')
  })

  it('“Allison took Green Bay at home to Carolina on Thursday night and won 27–19. Green Bay missed an extra point in the first quarter, and Carolina scored a touchdown with 5:37 left, but the two-point try failed … the rest of you”', () => {
    expect(whoOn('GB')).toEqual(['Allison'])
    const g = season.games.find((x) => x.id === '2026-w08-CAR-at-GB')!
    expect(g.homeTeamId).toBe('GB')
    expect(at(g.kickoffAt)).toMatch(/^Thursday/)
    expect(FINALS['2026-w08-CAR-at-GB']).toEqual([19, 27])
    const plays = SCORING['2026-w08-CAR-at-GB']!
    const pat = plays.find(([, , t, , text]) => t === 'GB' && /PAT Failed/.test(text))!
    expect(pat[0]).toBe(1)
    const late = plays.at(-1)!
    expect(late.slice(0, 3)).toEqual([4, '5:37', 'CAR'])
    expect(late[4]).toMatch(/Two-Point .*Failed/)
    for (const p of picks.filter((x) => x.teamId !== 'GB'))
      expect(at(season.games.find((x) => x.id === p.gameId)!.kickoffAt)).toMatch(/^Sunday/)
  })

  it('“Minnesota, 6–0 and the last unbeaten team in football, lost 19–15 at Detroit on a touchdown with 4:35 left. Last week I said Death had promised to sit on his hands … There are no unbeaten teams left”', () => {
    expect(record('MIN', 7)).toBe('6-0')
    expect(allTeams.filter((t) => /^\d+-0$/.test(record(t, 7)))).toEqual(['MIN'])
    expect(FINALS['2026-w08-MIN-at-DET']).toEqual([15, 19])
    const last = SCORING['2026-w08-MIN-at-DET']!.at(-1)!
    expect(last.slice(0, 3)).toEqual([4, '4:35', 'DET'])
    expect(last[4]).toMatch(/pass from|Rush/)
    expect(LAST_NOTE_SAID).toMatch(/promised to sit on his hands/)
    expect(allTeams.filter((t) => /^\d+-0$/.test(record(t)))).toEqual([])
  })

  it('“Nobody picked Chicago at Seattle, so the week was settled before Monday night kicked off. The Bears came into it 5–2, unbeaten since the weekend Joey was buried”', () => {
    const mnf = week(WEEK).at(-1)!
    expect(mnf.id).toBe('2026-w08-CHI-at-SEA')
    expect(at(mnf.kickoffAt)).toMatch(/^Monday/)
    expect(picks.filter((p) => p.gameId === mnf.id)).toHaveLength(0)
    expect(record('CHI', 7)).toBe('5-2')
    expect(livesAfter(4).get('Joseph Tomczuk')).toBeGreaterThan(0)
    expect(livesAfter(5).get('Joseph Tomczuk')).toBe(0)
    expect(winnerOf('2026-w05-CHI-at-GB')).toBe('GB')
    expect(record('CHI', 5)).toBe('3-2')
  })

  it('“Week 9: Pittsburgh and Tennessee are on bye. Thursday night is Jacksonville at Baltimore … Melanie can’t have the Jaguars twice. Five of you, four on your last life”', () => {
    const playing = new Set(week(9).flatMap((g) => [g.homeTeamId, g.awayTeamId]))
    expect(allTeams.filter((t) => !playing.has(t)).sort()).toEqual(['PIT', 'TEN'])
    const opener = week(9)[0]!
    expect([opener.awayTeamId, opener.homeTeamId]).toEqual(['JAX', 'BAL'])
    expect(at(opener.kickoffAt)).toMatch(/^Thursday/)
    expect(pickOf('Melanie Moeller', 8)?.teamId).toBe('JAX')
    expect([...after.values()].filter((l) => l > 0)).toHaveLength(5)
    expect(onLives(1)).toEqual(['Allison', 'Dominic', 'Melanie', 'Tracy'])
  })

  it('“DM me your week 9 pick on Teams before 7:10 PM Thursday, November 5 — five minutes before Jacksonville at Baltimore kicks off”', () => {
    expect(at(lockOf(9).toISOString())).toBe('Thursday, November 5 at 7:10 PM')
    expect(at(week(9)[0]!.kickoffAt)).toBe('Thursday, November 5 at 7:15 PM')
  })
})
