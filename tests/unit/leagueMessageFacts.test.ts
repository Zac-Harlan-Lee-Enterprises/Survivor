import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { NFL_TEAMS } from '../../src/domain/teams'
import {
  FINALS,
  SCORING,
  livesAfter,
  nameOf,
  pickOf,
  picksIn,
  pinnedThrough,
  season,
} from './seasonFacts'

/**
 * The commissioner's note states facts about the league to the people they are
 * about, so every one of them is asserted here against the season: the
 * pinned finals and scoring plays, and the recorded picks. Death's habits are
 * the only fiction in it. When these fail, the note needs rewriting — that is
 * the signal working, not a broken test.
 *
 * This note went up once the week 12 picks locked. From the lock the app shows
 * every pick, so the note names them; week 12 itself has no result yet, and the
 * note claims none.
 */
const WEEK = 11
const after = livesAfter(WEEK)
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
const source = readFileSync(
  new URL('../../src/features/league-home/LeagueMessage.tsx', import.meta.url),
  'utf8',
)
const body = source.slice(source.indexOf('const WEEK_12_PICKS'), source.indexOf('export function'))

// Paragraphs of the note, read from the TSX source: each string literal in
// `lines: [...]` is one paragraph, plus the callout. Never split on '.'.
const unescape = (lit: string) =>
  lit
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\(['"\\])/g, '$1')
const literals = (chunk: string) =>
  [...chunk.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)].map((m) => unescape(m[1]!))
const linesChunk = body.slice(
  body.indexOf('lines: ['),
  body.indexOf('],', body.indexOf('lines: [')),
)
const calloutChunk = body.slice(body.indexOf('callout:'))
const paragraphs = [
  ...literals(linesChunk.slice('lines: ['.length)),
  ...literals(calloutChunk.slice('callout:'.length)),
]

const last = (team: string, n: number) =>
  [...season.games]
    .filter((g) => g.week < 12 && (g.homeTeamId === team || g.awayTeamId === team))
    .sort((a, b) => b.week - a.week)
    .slice(0, n)
    .map((g) => {
      const [away, home] = FINALS[g.id]!
      return g.homeTeamId === team ? { own: home, other: away } : { own: away, other: home }
    })
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

describe('the commissioner’s week 12 picks note states only true things', () => {
  it('is written with week 11 settled and week 12 unplayed', () => {
    expect(pinnedThrough).toBe(WEEK)
    for (const p of picksIn(12)) expect(FINALS[p.gameId], p.gameId).toBeUndefined()
    expect(paragraphs).toHaveLength(6)
  })

  it('“All five week 12 picks are locked. There are 32 teams … the five of you found three: the Cowboys, the Giants and the Commanders. That is the NFC East, minus the one team in it two of you need to lose”', () => {
    const alive = [...after.entries()].filter(([, l]) => l > 0).map(([name]) => name)
    expect(alive).toHaveLength(5)
    expect(
      picksIn(12)
        .map((p) => nameOf(p.playerId))
        .sort(),
    ).toEqual([...alive].sort())
    expect([...new Set(picksIn(12).map((p) => p.teamId))].sort()).toEqual(['DAL', 'NYG', 'WAS'])
    for (const p of picksIn(12))
      expect(new Date(p.submittedAt).getTime(), p.playerId).toBeLessThan(lockOf(12).getTime())
    expect(NFL_TEAMS).toHaveLength(32)
    const east = NFL_TEAMS.filter((t) => t.conference === 'NFC' && t.division === 'East').map(
      (t) => t.id,
    )
    expect(east.sort()).toEqual(['DAL', 'NYG', 'PHI', 'WAS'])
    // The fourth, Philadelphia, is who Dallas plays: Allison and Melanie need it to lose.
    expect(season.games.find((g) => g.id === pickOf('Allison Petty', 12)!.gameId)!.awayTeamId).toBe(
      'PHI',
    )
  })

  it('“You have all already spent Kansas City, Buffalo, San Francisco and Jacksonville”', () => {
    for (const p of picksIn(12)) {
      const used = season.picks
        .filter((q) => q.playerId === p.playerId && q.week < 12)
        .map((q) => q.teamId)
      expect(used, p.playerId).toEqual(expect.arrayContaining(['KC', 'BUF', 'SF', 'JAX']))
    }
  })

  it('“Dominic already lost one life in week 4 by not picking anybody at all”', () => {
    expect(pickOf('Dominic Green', 4)).toBeNull()
    expect(livesAfter(3).get('Dominic Green')! - livesAfter(4).get('Dominic Green')!).toBe(1)
  })

  it('“Thursday opens with Chicago at Detroit at noon, which Joey and Maya, both rabid Bears fans, will be watching from the graveyard”', () => {
    const thursday = week(12).filter((g) => at(g.kickoffAt).startsWith('Thursday, November 26'))
    expect(thursday[0]!.id).toBe('2026-w12-CHI-at-DET')
    expect(at(thursday[0]!.kickoffAt)).toBe('Thursday, November 26 at 12:00 PM')
    // Both are out of the league; that they are Bears fans is the commissioner's word.
    expect(after.get('Joseph Tomczuk')).toBe(0)
    expect(after.get('Maya Israel')).toBe(0)
  })

  it('“Allison and Melanie have each handed their last life to the Dallas Cowboys on Thanksgiving”', () => {
    expect(on(12, 'DAL')).toEqual(['Allison', 'Melanie'])
    expect(after.get('Allison Petty')).toBe(1)
    expect(after.get('Melanie Moeller')).toBe(1)
    const game = season.games.find((g) => g.id === '2026-w12-PHI-at-DAL')!
    expect(game.homeTeamId).toBe('DAL')
    expect(at(game.kickoffAt)).toBe('Thursday, November 26 at 3:30 PM')
  })

  it('“Dallas has scored 91 points in its last two games and given up 76”', () => {
    const two = last('DAL', 2)
    expect(sum(two.map((g) => g.own))).toBe(91)
    expect(sum(two.map((g) => g.other))).toBe(76)
  })

  it('“Dominic and Tracy each lost a life on Dallas in week 5 … the rules won’t let them make the same mistake twice”', () => {
    expect(on(5, 'DAL')).toEqual(expect.arrayContaining(['Dominic', 'Tracy']))
    expect(FINALS['2026-w05-TB-at-DAL']).toEqual([24, 16])
    for (const name of ['Dominic Green', 'Tracy Nelson'])
      expect(livesAfter(4).get(name)! - livesAfter(5).get(name)!, name).toBe(1)
  })

  it('“Cindy and Dominic took the Giants at Indianapolis … the Colts scored 3 points last week, and the only end zone their quarterback reached was his own, flat on his back”', () => {
    expect(on(12, 'NYG')).toEqual(['Cindy', 'Dominic'])
    const game = season.games.find((g) => g.id === '2026-w12-NYG-at-IND')!
    expect(game.homeTeamId).toBe('IND')
    expect(at(game.kickoffAt)).toMatch(/^Sunday, November 29/)
    expect(FINALS['2026-w11-IND-at-HOU']).toEqual([3, 26])
    const safety = SCORING['2026-w11-IND-at-HOU']!.find((p) => /Safety/.test(p[4]))!
    expect(safety[2]).toBe('HOU')
    expect(safety[4]).toMatch(/^Daniel Jones Sacked by Will Anderson Jr\./)
  })

  it('“the Giants tied Washington 27–27 in week 5, and here a tie costs a life”', () => {
    expect(FINALS['2026-w05-NYG-at-WAS']).toEqual([27, 27])
    const ties = Object.entries(FINALS).filter(
      ([id, [a, h]]) => a === h && /NYG/.test(id) && pinnedThrough >= 5,
    )
    expect(ties).toHaveLength(1)
    const { league } = season as unknown as { league: { settings: { tieCountsAsMiss: boolean } } }
    expect(league.settings.tieCountsAsMiss).toBe(true)
  })

  it('“Cindy has two lives. Dominic has one”; four of the five are on their last life', () => {
    expect(after.get('Cindy Mendoza')).toBe(2)
    expect(after.get('Dominic Green')).toBe(1)
    expect(onLives(1)).toEqual(['Allison', 'Dominic', 'Melanie', 'Tracy'])
    expect(onLives(2)).toEqual(['Cindy'])
  })

  it('“Tracy is alone on Washington, the other half of that tie, out at Arizona … not one of you went with her”', () => {
    expect(on(12, 'WAS')).toEqual(['Tracy'])
    const game = season.games.find((g) => g.id === '2026-w12-WAS-at-ARI')!
    expect(game.homeTeamId).toBe('ARI')
    expect(at(game.kickoffAt)).toBe('Sunday, November 29 at 3:25 PM')
  })

  it('“Arizona has scored 16 points in its last three games; Kansas City had 27 on them by half time last week”', () => {
    expect(sum(last('ARI', 3).map((g) => g.own))).toBe(16)
    const id = '2026-w11-ARI-at-KC'
    expect(SCORING[id]!.filter((p) => p[0] <= 2).at(-1)![3]).toEqual([7, 27])
  })

  it('“If Dallas, the Giants and Washington all lose, four of you are dead by Sunday night and Cindy wins the whole league by losing”', () => {
    // Every pick this week is on one of those three, so all five lose a life:
    // the four on their last are out, and Cindy is the only one left.
    const left = picksIn(12).map((p) => [nameOf(p.playerId), after.get(nameOf(p.playerId))! - 1])
    expect(left.filter(([, l]) => (l as number) > 0)).toEqual([['Cindy Mendoza', 1]])
    expect(pickOf('Cindy Mendoza', 12)!.teamId).toBe('NYG')
  })

  it('“Week 13: DM me your pick on Teams before 7:10 PM Thursday, December 3”', () => {
    expect(at(lockOf(12).toISOString())).toBe('Wednesday, November 25 at 6:55 PM')
    expect(at(lockOf(13).toISOString())).toBe('Thursday, December 3 at 7:10 PM')
  })

  it('says nothing of messages or pick times', () => {
    expect(body).not.toMatch(/\b(messag|nudg|remind|chas)\w*/i)
    expect(body.replaceAll('late commissioner', '')).not.toMatch(/\b(sent|submitted|early|late)\b/i)
  })
})
