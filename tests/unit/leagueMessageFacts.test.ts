import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { NFL_TEAMS } from '../../src/domain/teams'
import {
  BOX,
  FINALS,
  SCORING,
  eliminatedWeekOf,
  crowd,
  livesAfter,
  lost,
  nameOf,
  pickOf,
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
 * Week 10's review went up once Sunday night settled the week, before any week
 * 11 pick.
 */
const WEEK = 10
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
const body = source.slice(source.indexOf('const WEEK_10_REVIEW'), source.indexOf('export function'))

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

describe('the commissioner’s week 10 review states only true things', () => {
  it('is written from a settled week: every week 10 pick has its final', () => {
    expect(pinnedThrough).toBe(WEEK)
  })

  it('“three weeks running without a funeral and fifteen winning picks in a row; before week 8 this league had never once gone a week without losing a life. There are still twenty-five headstones”', () => {
    for (const w of [8, 9, 10]) expect(lostIn(w), `week ${w}`).toBe(0)
    for (let w = 1; w < 8; w++) expect(lostIn(w), `week ${w}`).toBeGreaterThan(0)
    const run = [...picksIn(8), ...picksIn(9), ...picksIn(10)]
    expect(run).toHaveLength(15)
    expect(run.filter(lost)).toEqual([])
    expect([...after.values()].filter((l) => l === 0)).toHaveLength(25)
  })

  it('“Dominic, Tracy and Allison all took Jacksonville at Tennessee, and the Jaguars won 40–23 and kept the ball for 38 minutes. Tennessee is 1–8”', () => {
    expect(on(WEEK, 'JAX')).toEqual(['Allison', 'Dominic', 'Tracy'])
    expect(FINALS['2026-w10-JAX-at-TEN']).toEqual([40, 23])
    expect(BOX['2026-w10-JAX-at-TEN']!.teams.JAX!.possession).toMatch(/^38:/)
    expect(record('TEN', WEEK)).toBe('1-8')
  })

  it('“Its one win all season came in week 6, on the afternoon Chloe, Corey and Joanna were buried, so Tennessee has now knocked three of you out of this league and beaten one football team”', () => {
    const tenWins = Object.keys(FINALS).filter((id) => {
      const g = season.games.find((x) => x.id === id)!
      return g.week <= WEEK && winnerOf(id) === 'TEN'
    })
    expect(tenWins).toEqual(['2026-w06-TEN-at-IND'])
    const buried = picksIn(6)
      .filter((p) => p.teamId === 'IND' && eliminatedWeekOf(p.playerId, WEEK) === 6)
      .map((p) => nameOf(p.playerId))
    expect(firstNames(buried)).toEqual(['Chloe', 'Corey', 'Joanna'])
  })

  it('“Joey Slye, the kicker whose four field goals did the burying that day, kicked three from 50 yards or more on Sunday. It made no difference”', () => {
    expect(BOX['2026-w06-TEN-at-IND']!.players['Joey Slye']).toMatchObject({
      team: 'TEN',
      fieldGoals: [4, 4],
    })
    const long = SCORING['2026-w10-JAX-at-TEN']!.filter((p) => {
      const m = /^Joey Slye (\d+) Yd Field Goal/.exec(p[4])
      return m && Number(m[1]) >= 50
    })
    expect(long).toHaveLength(3)
    expect(winnerOf('2026-w10-JAX-at-TEN')).toBe('JAX')
  })

  it('“Cindy took Seattle at Las Vegas, whose quarterback is Fernando Mendoza. Seattle sacked him six times, the Raiders gained 163 yards all afternoon, and Seattle won 21–13. So a Mendoza beat a Mendoza”', () => {
    expect(on(WEEK, 'SEA')).toEqual(['Cindy'])
    const id = '2026-w10-SEA-at-LV'
    const passers = Object.entries(BOX[id]!.players).filter(
      ([, b]) => b.team === 'LV' && b.attempts,
    )
    expect(passers.map(([n]) => n)).toEqual(['Fernando Mendoza'])
    expect(BOX[id]!.teams.LV!.sacked).toBe(6)
    expect(BOX[id]!.teams.LV!.totalYards).toBe(163)
    expect(FINALS[id]).toEqual([21, 13])
    expect(at(gameOf(WEEK, 'SEA')!.kickoffAt)).toBe('Sunday, November 15 at 3:05 PM')
    expect(nameOf('cindy-mendoza')).toBe('Cindy Mendoza')
  })

  it('“Cindy has now picked a winner in nine of her ten weeks and is still the only one of you on two lives”', () => {
    const cindy = season.picks.filter((p) => p.playerId === 'cindy-mendoza' && p.week <= WEEK)
    expect(cindy).toHaveLength(10)
    expect(cindy.filter((p) => !lost(p))).toHaveLength(9)
    expect(onLives(2)).toEqual(['Cindy'])
  })

  it('“Melanie took Buffalo at the Jets and won 31–12. The Jets played two quarterbacks, got into the red zone twice, came away with nothing either time, and scored all twelve of their points on Jason Sanders field goals. They are 2–8”', () => {
    const id = '2026-w10-BUF-at-NYJ'
    expect(on(WEEK, 'BUF')).toEqual(['Melanie'])
    expect(FINALS[id]).toEqual([31, 12])
    const jetsQBs = Object.values(BOX[id]!.players).filter((b) => b.team === 'NYJ' && b.attempts)
    expect(jetsQBs).toHaveLength(2)
    expect(BOX[id]!.teams.NYJ!.redZone).toEqual([0, 2])
    const jets = SCORING[id]!.filter((p) => p[2] === 'NYJ')
    expect(jets.every((p) => /^Jason Sanders \d+ Yd Field Goal/.test(p[4]))).toBe(true)
    expect(jets.length * 3).toBe(12)
    expect(record('NYJ', WEEK)).toBe('2-8')
  })

  it('“the Jets … cost Allison a life and buried Dave in week 7, the day Miami won its first game”', () => {
    const id = '2026-w07-MIA-at-NYJ'
    expect(pickOf('Allison Petty', 7)).toMatchObject({ teamId: 'NYJ', gameId: id })
    expect(pickOf('Dave Johnson', 7)).toMatchObject({ teamId: 'NYJ', gameId: id })
    expect(winnerOf(id)).toBe('MIA')
    expect(eliminatedWeekOf('dave-johnson', WEEK)).toBe(7)
    expect(record('MIA', 6)).toMatch(/^0-/)
  })

  it('“The two best teams in football, San Francisco and Buffalo, are 8–1, and all five of you have used San Francisco. Jacksonville and Cincinnati are 7–2, and all five of you have used both of them too”', () => {
    const wins = (t: string) => Number(record(t, WEEK).split('-')[0])
    const best = Math.max(...allTeams.map(wins))
    expect(allTeams.filter((t) => wins(t) === best).sort()).toEqual(['BUF', 'SF'])
    expect(record('SF', WEEK)).toBe('8-1')
    expect(record('BUF', WEEK)).toBe('8-1')
    expect(record('JAX', WEEK)).toBe('7-2')
    expect(record('CIN', WEEK)).toBe('7-2')
    expect(alive).toHaveLength(5)
    for (const team of ['SF', 'JAX', 'CIN'])
      for (const p of alive)
        expect(
          season.picks.some(
            (x) => x.playerId === p.playerId && x.week <= WEEK && x.teamId === team,
          ),
          `${p.displayName} ${team}`,
        ).toBe(true)
  })

  it('“Nobody picked San Francisco at Dallas, which finished 46–40: eighty-six points … Dallas, the team twenty-one of you lost with in week 5, lost again”', () => {
    const id = '2026-w10-SF-at-DAL'
    expect(FINALS[id]).toEqual([46, 40])
    expect(FINALS[id]![0] + FINALS[id]![1]).toBe(86)
    expect(picksIn(WEEK).filter((p) => p.gameId === id)).toEqual([])
    const dal5 = picksIn(5).filter((p) => p.teamId === 'DAL')
    expect(dal5).toHaveLength(21)
    expect(dal5.every(lost)).toBe(true)
    expect(winnerOf(id)).toBe('SF')
  })

  it('“Nobody picked the Chargers at Baltimore on Monday night either, so the week was settled on Sunday. The Chargers are 0–8. Seven of you took them in week 1”', () => {
    const mnf = week(WEEK).at(-1)!
    expect(mnf.id).toBe('2026-w10-LAC-at-BAL')
    expect(at(mnf.kickoffAt)).toMatch(/^Monday/)
    expect(picksIn(WEEK).filter((p) => p.gameId === mnf.id)).toEqual([])
    expect(record('LAC', WEEK)).toBe('0-8')
    expect(crowd(1, 'LAC')).toBe(7)
  })

  it('“Week 11: Atlanta, Cleveland, Green Bay, the Rams, New England and Seattle are on bye … Thursday night is Indianapolis at Houston, which locks the week”', () => {
    const playing = new Set(week(11).flatMap((g) => [g.homeTeamId, g.awayTeamId]))
    expect(allTeams.filter((t) => !playing.has(t)).sort()).toEqual([
      'ATL',
      'CLE',
      'GB',
      'LAR',
      'NE',
      'SEA',
    ])
    expect(week(11)[0]!.id).toBe('2026-w11-IND-at-HOU')
    expect(at(week(11)[0]!.kickoffAt)).toMatch(/^Thursday/)
  })

  it('“Houston is the team six of you took in week 7 and lost with, 27–21 in overtime; Cindy and Melanie are the only two of those six still alive, and neither can have Houston again”', () => {
    const id = '2026-w07-NYG-at-HOU'
    expect(crowd(7, 'HOU')).toBe(6)
    expect(FINALS[id]).toEqual([27, 21])
    expect(winnerOf(id)).toBe('NYG')
    expect(SCORING[id]!.at(-1)![0]).toBe(5)
    const six = picksIn(7)
      .filter((p) => p.teamId === 'HOU')
      .map((p) => nameOf(p.playerId))
    expect(firstNames(six.filter((n) => after.get(n)! > 0))).toEqual(['Cindy', 'Melanie'])
  })

  it('“Five of you, four on your last life, Cindy on two”', () => {
    expect(alive).toHaveLength(5)
    expect(onLives(1)).toEqual(['Allison', 'Dominic', 'Melanie', 'Tracy'])
  })

  it('“DM me your week 11 pick on Teams before 7:10 PM Thursday, November 19, five minutes before Indianapolis at Houston kicks off”', () => {
    expect(at(lockOf(11).toISOString())).toBe('Thursday, November 19 at 7:10 PM')
    expect(at(week(11)[0]!.kickoffAt)).toBe('Thursday, November 19 at 7:15 PM')
  })

  it('names no week 11 pick: no paragraph that names a player names their team or its opponent', () => {
    expect(paragraphs).toHaveLength(9)
    const leaks: string[] = []
    for (const pick of picksIn(11)) {
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
