import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  FINALS,
  SCORING,
  TURNOVERS,
  crowd,
  eliminatedWeekOf,
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
 * The commissioner's note states facts about the league to the people they are
 * about, so every one of them is asserted here against the season: the
 * pinned finals and scoring plays, and the recorded picks. Death's habits are
 * the only fiction in it. When these fail, the note needs rewriting — that is
 * the signal working, not a broken test.
 */
const WEEK = 7
const picks = picksIn(WEEK)
const before = livesAfter(WEEK - 1)
const after = livesAfter(WEEK)
const firstNames = (names: string[]) => names.map((n) => n.split(' ')[0]!).sort()
const whoOn = (teamId: string) =>
  firstNames(picks.filter((p) => p.teamId === teamId).map((p) => nameOf(p.playerId)))
const onLives = (n: number) =>
  firstNames([...after.entries()].filter(([, l]) => l === n).map(([name]) => name))
const outIn = (week: number) =>
  season.profiles
    .filter((p) => eliminatedWeekOf(p.playerId, week) === week)
    .map((p) => p.displayName)
const at = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'long',
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

/** The message from beyond (week 7's note, now replaced), which this one calls back to. */
const LAST_NOTE_SAID =
  'He’s already sharpened his pencil, cleared space in the cemetery, and asked whether we offer a group rate.'

const source = readFileSync(
  new URL('../../src/features/league-home/LeagueMessage.tsx', import.meta.url),
  'utf8',
)
const body = source.slice(source.indexOf('const WEEK_7_REVIEW'), source.indexOf('export function'))

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

describe('the week 7 review gives away nothing about week 8', () => {
  it('mentions week 8 picks only to ask for them', () => {
    expect(body.match(/week 8 pick/gi) ?? []).toHaveLength(1)
    expect(body).toMatch(/DM me your week 8 pick on Teams/)
  })

  it('never names a player in the same sentence as the team they have picked for week 8', () => {
    expect(teamNames.size).toBe(32)
    const sentences = body.split(/(?<=[.!?])\s+/)
    for (const p of picksIn(8)) {
      const first = nameOf(p.playerId).split(' ')[0]!
      for (const s of sentences.filter((x) => new RegExp(`\\b${first}\\b`).test(x))) {
        for (const n of teamNames.get(p.teamId)!) {
          expect(new RegExp(`\\b${n}\\b`).test(s), `${first} beside ${n}: “${s}”`).toBe(false)
        }
      }
    }
  })
})

describe('the commissioner’s week 7 review states only true things', () => {
  it('“Last week Death asked whether we offer a group rate”: the message from beyond said so', () => {
    expect(LAST_NOTE_SAID).toMatch(/asked whether we offer a group rate/)
    expect(body).toMatch(/Last week Death asked whether we offer a group rate/)
  })

  it('“six of you took Houston at home to the Giants … tied it 21–21 with fifty-two seconds left … lost 27–21 in overtime on a thirty-yard run”', () => {
    expect(whoOn('HOU')).toHaveLength(6)
    expect(gamesById.get('2026-w07-NYG-at-HOU')).toMatchObject({
      homeTeamId: 'HOU',
      awayTeamId: 'NYG',
    })
    expect(FINALS['2026-w07-NYG-at-HOU']).toEqual([27, 21])
    const plays = SCORING['2026-w07-NYG-at-HOU']!
    const tie = plays.find(([, , , score]) => score.join() === '21,21')!
    expect(tie.slice(0, 3)).toEqual([4, '0:52', 'HOU'])
    const last = plays.at(-1)!
    expect(last[0]).toBe(5) // overtime
    expect(last[2]).toBe('NYG')
    expect(last[4]).toMatch(/^\S.* 30 Yd Rush$/)
    expect(picks.filter((p) => p.teamId === 'HOU').every(lost)).toBe(true)
  })

  it('“Dave and Allison took the Jets at home to Miami. Before Sunday, fifty-one of this league’s picks had gone against the Dolphins, and all fifty-one had won … their first game of the season, 28–25, against the only two of us who picked against them”', () => {
    expect(whoOn('NYJ')).toEqual(['Allison', 'Dave'])
    expect(gamesById.get('2026-w07-MIA-at-NYJ')!.homeTeamId).toBe('NYJ')
    const againstMiami = season.picks.filter((p) => {
      const g = gamesById.get(p.gameId)!
      return [g.homeTeamId, g.awayTeamId].includes('MIA') && p.teamId !== 'MIA'
    })
    const earlier = againstMiami.filter((p) => p.week < WEEK)
    expect(earlier).toHaveLength(51)
    expect(earlier.some(lost)).toBe(false)
    expect(record('MIA', WEEK - 1)).toBe('0-5')
    expect(FINALS['2026-w07-MIA-at-NYJ']).toEqual([28, 25])
    expect(winnerOf('2026-w07-MIA-at-NYJ')).toBe('MIA')
    expect(
      firstNames(againstMiami.filter((p) => p.week === WEEK).map((p) => nameOf(p.playerId))),
    ).toEqual(['Allison', 'Dave'])
  })

  it('“Jason went alone with Carolina and lost 43–13 to Tampa Bay. Carolina turned it over four times … Tampa Bay blocked the extra point, ran it back, and were given two points”', () => {
    expect(whoOn('CAR')).toEqual(['Jason'])
    expect(FINALS['2026-w07-TB-at-CAR']).toEqual([43, 13])
    expect(TURNOVERS['2026-w07-TB-at-CAR']!.CAR).toBe(4)
    const plays = SCORING['2026-w07-TB-at-CAR']!
    const td = plays.findIndex(([, , team, , text]) => team === 'CAR' && /PAT blocked/.test(text))
    expect(td).toBeGreaterThanOrEqual(0)
    // Carolina's first score of the game was that touchdown.
    expect(plays.findIndex(([, , team]) => team === 'CAR')).toBe(td)
    expect(plays[td + 1]![2]).toBe('TB')
    expect(plays[td + 1]![4]).toMatch(/Defensive PAT Conversion/)
    expect(plays[td + 1]![3][0] - plays[td]![3][0]).toBe(2)
  })

  it('“Wesley sent no pick, for the second week running”', () => {
    expect(pickOf('Wesley Childers', 6)).toBeNull()
    expect(pickOf('Wesley Childers', 7)).toBeNull()
  })

  it('“seven of you were knocked out this week. Bradley, Maya, Mike and Shahid went down with Houston, Dave with the Jets, Jason with Carolina, and Wesley with nothing at all”', () => {
    const out = outIn(WEEK)
    expect(out).toHaveLength(7)
    const by = (team: string | null) =>
      firstNames(out.filter((n) => (pickOf(n, WEEK)?.teamId ?? null) === team))
    expect(by('HOU')).toEqual(['Bradley', 'Maya', 'Mike', 'Shahid'])
    expect(by('NYJ')).toEqual(['Dave'])
    expect(by('CAR')).toEqual(['Jason'])
    expect(by(null)).toEqual(['Wesley'])
  })

  it('“twenty-five headstones and five of you still standing”', () => {
    expect([...after.values()].filter((l) => l === 0)).toHaveLength(25)
    expect([...after.values()].filter((l) => l > 0)).toHaveLength(5)
  })

  it('“Every single one of you who had company this week lost a life, and the only two who came through clean went alone”', () => {
    for (const p of picks.filter((x) => crowd(WEEK, x.teamId) > 1))
      expect(lost(p), p.playerId).toBe(true)
    const clean = [...after.entries()]
      .filter(([n, l]) => l > 0 && l === before.get(n))
      .map(([n]) => n)
    expect(firstNames(clean)).toEqual(['Dominic', 'Tracy'])
    for (const n of clean) expect(crowd(WEEK, pickOf(n, WEEK)!.teamId)).toBe(1)
  })

  it('“The most popular pick has now lost three weeks running — Dallas, the Rams, Houston — and is zero for forty”', () => {
    expect(top(5)).toEqual([['DAL', 21]])
    expect(top(6)).toEqual([['LAR', 13]])
    expect(top(7)).toEqual([['HOU', 6]])
    for (const w of [5, 6, 7]) {
      const [team] = top(w)[0]!
      expect(
        picksIn(w)
          .filter((p) => p.teamId === team)
          .every(lost),
      ).toBe(true)
    }
    expect(21 + 13 + 6).toBe(40)
    // And it won the week before: three weeks running, not four.
    const [team4] = top(4)[0]!
    expect(
      picksIn(4)
        .filter((p) => p.teamId === team4)
        .some(lost),
    ).toBe(false)
  })

  it('“Cindy lost her first life of the season — six straight wins, then Houston — and is still the only one of you on two. Allison and Melanie are down to their last”', () => {
    const cindy = season.picks.filter((p) => p.playerId === 'cindy-mendoza' && p.week < WEEK)
    expect(cindy).toHaveLength(6)
    expect(cindy.some(lost)).toBe(false)
    expect(pickOf('Cindy Mendoza', WEEK)?.teamId).toBe('HOU')
    expect(onLives(3)).toEqual([])
    expect(onLives(2)).toEqual(['Cindy'])
    expect(before.get('Allison Petty')).toBe(2)
    expect(before.get('Melanie Moeller')).toBe(2)
    expect(after.get('Allison Petty')).toBe(1)
    expect(after.get('Melanie Moeller')).toBe(1)
  })

  it('“Dominic went alone with Minnesota and won 16–10 … the Vikings are now 6–0, the last unbeaten team, because San Francisco lost at Atlanta and Kansas City managed three points in Seattle”', () => {
    expect(whoOn('MIN')).toEqual(['Dominic'])
    expect(FINALS['2026-w07-IND-at-MIN']).toEqual([10, 16])
    expect(record('MIN')).toBe('6-0')
    expect(allTeams.filter((t) => /^\d+-0$/.test(record(t)))).toEqual(['MIN'])
    expect(allTeams.filter((t) => /^\d+-0$/.test(record(t, WEEK - 1))).sort()).toEqual([
      'KC',
      'MIN',
      'SF',
    ])
    expect(winnerOf('2026-w07-SF-at-ATL')).toBe('ATL')
    expect(FINALS['2026-w07-KC-at-SEA']).toEqual([3, 20])
  })

  it('“Tracy went alone with Denver and won 30–16 in Arizona”', () => {
    expect(whoOn('DEN')).toEqual(['Tracy'])
    expect(FINALS['2026-w07-DEN-at-ARI']).toEqual([30, 16])
    expect(gamesById.get('2026-w07-DEN-at-ARI')!.homeTeamId).toBe('ARI')
  })

  it('“Nobody picked Dallas at Philadelphia, so the week was settled before Monday night kicked off”', () => {
    const mnf = gamesById.get('2026-w07-DAL-at-PHI')!
    expect(at(mnf.kickoffAt)).toMatch(/^Monday/)
    expect(picks.filter((p) => p.gameId === mnf.id)).toHaveLength(0)
    for (const p of picks) {
      expect(new Date(gamesById.get(p.gameId)!.kickoffAt).getTime()).toBeLessThan(
        new Date(mnf.kickoffAt).getTime(),
      )
    }
  })

  it('“Week 8: Houston, New Orleans, the Giants and San Francisco are on bye. Thursday night is Carolina at Green Bay … Minnesota, 6–0, go to Detroit, and of the five of you left, only Allison can still pick them”', () => {
    const week8 = season.games.filter((g) => g.week === 8)
    const playing = new Set(week8.flatMap((g) => [g.homeTeamId, g.awayTeamId]))
    expect(allTeams.filter((t) => !playing.has(t)).sort()).toEqual(['HOU', 'NO', 'NYG', 'SF'])
    const opener = [...week8].sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))[0]!
    expect([opener.awayTeamId, opener.homeTeamId]).toEqual(['CAR', 'GB'])
    expect(at(opener.kickoffAt)).toMatch(/^Thursday/)
    expect(week8.find((g) => g.awayTeamId === 'MIN')?.homeTeamId).toBe('DET')
    const alive = season.profiles.filter((p) => after.get(p.displayName)! > 0)
    const canPickMinnesota = alive.filter(
      (p) => !season.picks.some((x) => x.playerId === p.playerId && x.teamId === 'MIN'),
    )
    expect(firstNames(canPickMinnesota.map((p) => p.displayName))).toEqual(['Allison'])
  })

  it('“DM me your week 8 pick … before 7:10 PM Thursday — five minutes before Carolina at Green Bay kicks off. Four of you are on your last life”', () => {
    const week8 = season.games.filter((g) => g.week === 8)
    const opener = [...week8].sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))[0]!
    const lock = new Date(new Date(opener.kickoffAt).getTime() - 5 * 60_000)
    expect(at(lock.toISOString())).toBe('Thursday 7:10 PM')
    expect(onLives(1)).toEqual(['Allison', 'Dominic', 'Melanie', 'Tracy'])
  })
})
