import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { NFL_TEAMS } from '../../src/domain/teams'
import {
  BOX,
  FINALS,
  SCORING,
  livesAfter,
  lost,
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
 * Week 11's review went up once Sunday night settled the week, before any week
 * 12 pick.
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
const lostIn = (w: number) => {
  const b = livesAfter(w - 1)
  let n = 0
  for (const [name, l] of livesAfter(w)) n += b.get(name)! - l
  return n
}
const source = readFileSync(
  new URL('../../src/features/league-home/LeagueMessage.tsx', import.meta.url),
  'utf8',
)
const body = source.slice(source.indexOf('const WEEK_11_REVIEW'), source.indexOf('export function'))

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

const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** Every way the note could name a team; a location shared by two teams names neither. */
const teamWords = (id: string) => {
  const t = NFL_TEAMS.find((x) => x.id === id)!
  const shared = (w: string) =>
    NFL_TEAMS.filter((o) =>
      [o.location, ...o.aliases].some((a) => a.toLowerCase() === w.toLowerCase()),
    ).length > 1
  return [t.id, t.location, t.name, ...t.aliases].filter((w) => !shared(w))
}
const nameParts = (full: string) => full.split(/\s+/)
/** The first word of `words` found in `text` (case-insensitive, whole words), else null. */
const mentions = (text: string, words: string[]): string | null =>
  words.find((w) => new RegExp(`(?<![\\w])${esc(w)}(?![\\w])`, 'i').test(text)) ?? null

describe('the commissioner’s week 11 review states only true things', () => {
  it('is written from a settled week: every week 11 pick has its final', () => {
    expect(pinnedThrough).toBe(WEEK)
  })

  it('“Five picks, five winners, again. That is twenty in a row, and four straight weeks without anyone losing a life, in a league where somebody had lost one every single week before that”', () => {
    expect(picksIn(WEEK)).toHaveLength(5)
    expect(picksIn(WEEK).filter(lost)).toEqual([])
    for (const w of [8, 9, 10, 11]) expect(lostIn(w), `week ${w}`).toBe(0)
    for (let w = 1; w < 8; w++) expect(lostIn(w), `week ${w}`).toBeGreaterThan(0)
    const run = [8, 9, 10, 11].flatMap((w) => picksIn(w))
    expect(run).toHaveLength(20)
    expect(run.filter(lost)).toEqual([])
  })

  it('“Allison took Houston over the Colts, the team that cost her a life in week 6. Houston won 26–3 … Daniel Jones … did reach an end zone: it was his own, and Will Anderson Jr. sacked him in it for a safety”', () => {
    const id = '2026-w11-IND-at-HOU'
    expect(on(WEEK, 'HOU')).toEqual(['Allison'])
    expect(FINALS[id]).toEqual([3, 26])
    const allison6 = pickOf('Allison Petty', 6)!
    expect(allison6.teamId).toBe('IND')
    expect(lost(allison6)).toBe(true)
    // The Colts never reached Houston's end zone: their only score was a field goal.
    const colts = SCORING[id]!.filter((p) => p[2] === 'IND')
    expect(colts).toHaveLength(1)
    expect(colts[0]![4]).toMatch(/Field Goal/)
    const safety = SCORING[id]!.find((p) => /Safety/.test(p[4]))!
    expect(safety[2]).toBe('HOU')
    expect(safety[4]).toMatch(/^Daniel Jones Sacked by Will Anderson Jr\./)
  })

  it('“Cindy, Dominic and Tracy all piled onto Buffalo, who beat Miami 26–9. Bills kicker Tyler Bass scored 14 points. Miami … scored 9. Kyle McCord threw 33 passes for 102 yards, which is about three yards a throw”', () => {
    const id = '2026-w11-MIA-at-BUF'
    expect(on(WEEK, 'BUF')).toEqual(['Cindy', 'Dominic', 'Tracy'])
    expect(FINALS[id]).toEqual([9, 26])
    expect(BOX[id]!.players['Tyler Bass']).toMatchObject({ team: 'BUF', points: 14 })
    const mccord = BOX[id]!.players['Kyle McCord']!
    expect(mccord).toMatchObject({ team: 'MIA', attempts: 33, passingYards: 102 })
    expect(Math.round(mccord.passingYards! / mccord.attempts!)).toBe(3)
  })

  it('“Melanie is on her last life, and two weeks ago she handed it to the Bears, whose quarterback threw four interceptions before a field goal saved her with no time left”', () => {
    expect(after.get('Melanie Moeller')).toBe(1)
    expect(livesAfter(8).get('Melanie Moeller')).toBe(1)
    expect(pickOf('Melanie Moeller', 9)!.teamId).toBe('CHI')
    expect(BOX['2026-w09-TB-at-CHI']!.players['Caleb Williams']!.interceptions).toBe(4)
    expect(SCORING['2026-w09-TB-at-CHI']!.at(-1)).toEqual([
      4,
      '0:00',
      'CHI',
      [24, 27],
      'Cairo Santos 38 Yd Field Goal',
    ])
  })

  it('“This week she took Kansas City, who led 27–7 at half time and won 34–7”', () => {
    const id = '2026-w11-ARI-at-KC'
    expect(on(WEEK, 'KC')).toEqual(['Melanie'])
    expect(SCORING[id]!.filter((p) => p[0] <= 2).at(-1)![3]).toEqual([7, 27])
    expect(FINALS[id]).toEqual([7, 34])
  })

  it('“Picks lock Wednesday, not Thursday: Green Bay at the Rams kicks off Wednesday night at 7:00 Central, so the door shuts at 6:55 PM on November 25 … four of you on your last life”', () => {
    expect(week(12)[0]!.id).toBe('2026-w12-GB-at-LAR')
    expect(at(week(12)[0]!.kickoffAt)).toBe('Wednesday, November 25 at 7:00 PM')
    expect(at(lockOf(12).toISOString())).toBe('Wednesday, November 25 at 6:55 PM')
    expect(onLives(1)).toEqual(['Allison', 'Dominic', 'Melanie', 'Tracy'])
  })

  it('“DM me your week 12 pick on Teams before 6:55 PM Wednesday, November 25, five minutes before Green Bay at the Rams kicks off”', () => {
    expect(at(lockOf(12).toISOString())).toBe('Wednesday, November 25 at 6:55 PM')
    expect(at(week(12)[0]!.kickoffAt)).toBe('Wednesday, November 25 at 7:00 PM')
  })

  it('names no week 12 pick: no paragraph that names a player names their team or its opponent', () => {
    expect(paragraphs).toHaveLength(6)
    const leaks: string[] = []
    for (const pick of picksIn(12)) {
      const game = season.games.find((g) => g.id === pick.gameId)!
      const opponent = game.homeTeamId === pick.teamId ? game.awayTeamId : game.homeTeamId
      const words = [...teamWords(pick.teamId), ...teamWords(opponent)]
      const who = nameParts(nameOf(pick.playerId))
      for (const para of paragraphs) {
        if (!mentions(para, who)) continue
        const hit = mentions(para, words)
        if (hit) leaks.push(`${nameOf(pick.playerId)}: "${hit}" in: ${para.slice(0, 60)}…`)
      }
    }
    expect(leaks).toEqual([])
  })

  it('the leak matcher catches a leak and passes a clean paragraph', () => {
    const cindy = nameParts('Cindy Mendoza')
    const dominic = nameParts('Dominic Green')
    const sea = [...teamWords('SEA'), ...teamWords('LV')]
    const jax = [...teamWords('JAX'), ...teamWords('TEN')]
    const leaks = (text: string, who: string[], words: string[]) =>
      Boolean(mentions(text, who) && mentions(text, words))
    expect(leaks('Cindy went with the hawks', cindy, sea)).toBe(true)
    expect(leaks('Mendoza took Seattle', cindy, sea)).toBe(true)
    expect(leaks('Cindy is off to Las Vegas', cindy, sea)).toBe(true)
    expect(leaks('Dominic likes the JAGUARS', dominic, jax)).toBe(true)
    expect(leaks('Cindy is still on two lives. Seattle is far away.', cindy, [])).toBe(false)
    expect(leaks('Cindy has two lives left', cindy, sea)).toBe(false)
  })

  it('says nothing of messages or pick times', () => {
    expect(body).not.toMatch(/\b(messag|nudg|remind|chas)\w*/i)
    expect(body.replaceAll('late commissioner', '')).not.toMatch(/\b(sent|submitted|early|late)\b/i)
  })
})
