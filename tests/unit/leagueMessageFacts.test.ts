import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { NFL_TEAMS } from '../../src/domain/teams'
import {
  BOX,
  FINALS,
  SCORING,
  eliminatedWeekOf,
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
 * Week 11's review went up once Sunday night settled the week, before any week
 * 12 pick.
 */
const WEEK = 11
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
  const winsOf = (team: string) =>
    Object.keys(FINALS).filter((id) => {
      const g = season.games.find((x) => x.id === id)!
      return g.week <= WEEK && winnerOf(id) === team
    })
  const buriedBy = (w: number, team: string) =>
    firstNames(
      picksIn(w)
        .filter((p) => p.teamId === team && eliminatedWeekOf(p.playerId, WEEK) === w)
        .map((p) => nameOf(p.playerId)),
    )
  const usedByAll = (team: string) =>
    alive.every((p) =>
      season.picks.some((x) => x.playerId === p.playerId && x.week <= WEEK && x.teamId === team),
    )

  it('is written from a settled week: every week 11 pick has its final', () => {
    expect(pinnedThrough).toBe(WEEK)
  })

  it('“four weeks running without a funeral and twenty winning picks in a row, and there are still twenty-five headstones”', () => {
    for (const w of [8, 9, 10, 11]) expect(lostIn(w), `week ${w}`).toBe(0)
    expect(lostIn(7)).toBeGreaterThan(0)
    const run = [8, 9, 10, 11].flatMap((w) => picksIn(w))
    expect(run).toHaveLength(20)
    expect(run.filter(lost)).toEqual([])
    expect([...after.values()].filter((l) => l === 0)).toHaveLength(25)
  })

  it('“Allison took Houston at home to Indianapolis on Thursday night and won 26–3. The Colts kicked a field goal in the first quarter and never scored again, and in the third Will Anderson Jr. sacked Daniel Jones in his own end zone for a safety”', () => {
    const id = '2026-w11-IND-at-HOU'
    expect(on(WEEK, 'HOU')).toEqual(['Allison'])
    expect(FINALS[id]).toEqual([3, 26])
    expect(at(gameOf(WEEK, 'HOU')!.kickoffAt)).toMatch(/^Thursday/)
    const colts = SCORING[id]!.filter((p) => p[2] === 'IND')
    expect(colts).toHaveLength(1)
    expect(colts[0]![0]).toBe(1)
    expect(colts[0]![4]).toMatch(/Field Goal/)
    const safety = SCORING[id]!.find((p) => /Safety/.test(p[4]))!
    expect(safety[0]).toBe(3)
    expect(safety[4]).toMatch(/^Daniel Jones Sacked by Will Anderson Jr\./)
  })

  it('“Allison lost a life on the Colts in week 6. Houston is the team that cost Cindy and Melanie a life in week 7”', () => {
    const allison6 = pickOf('Allison Petty', 6)!
    expect(allison6.teamId).toBe('IND')
    expect(lost(allison6)).toBe(true)
    for (const name of ['Cindy Mendoza', 'Melanie Moeller']) {
      const p = pickOf(name, 7)!
      expect(p.teamId, name).toBe('HOU')
      expect(lost(p), name).toBe(true)
    }
  })

  it('“Cindy, Dominic and Tracy all took Buffalo at home to Miami and won 26–9. Josh Allen threw two interceptions … Tyler Bass kicked four field goals, Miami’s quarterback completed 12 of 33 passes for 102 yards, and all nine of Miami’s points were field goals”', () => {
    const id = '2026-w11-MIA-at-BUF'
    expect(on(WEEK, 'BUF')).toEqual(['Cindy', 'Dominic', 'Tracy'])
    expect(FINALS[id]).toEqual([9, 26])
    expect(BOX[id]!.players['Josh Allen']!.interceptions).toBe(2)
    expect(BOX[id]!.players['Tyler Bass']!.fieldGoals).toEqual([4, 4])
    expect(BOX[id]!.players['Kyle McCord']).toMatchObject({
      team: 'MIA',
      completions: 12,
      attempts: 33,
      passingYards: 102,
    })
    const miami = SCORING[id]!.filter((p) => p[2] === 'MIA')
    expect(miami.every((p) => /Field Goal/.test(p[4]))).toBe(true)
    expect(miami.length * 3).toBe(9)
  })

  it('“Miami is 1–9. So is Tennessee. Each has won exactly one game all season, and each of those wins buried somebody in this league: Tennessee’s took Chloe, Corey and Joanna in week 6, and Miami’s took Dave in week 7”', () => {
    expect(record('MIA', WEEK)).toBe('1-9')
    expect(record('TEN', WEEK)).toBe('1-9')
    expect(winsOf('TEN')).toEqual(['2026-w06-TEN-at-IND'])
    expect(winsOf('MIA')).toEqual(['2026-w07-MIA-at-NYJ'])
    expect(buriedBy(6, 'IND')).toEqual(['Chloe', 'Corey', 'Joanna'])
    expect(buriedBy(7, 'NYJ')).toEqual(['Dave'])
  })

  it('“Melanie took Kansas City at home to Arizona and won 34–7. Patrick Mahomes threw three touchdowns, two of them to Travis Kelce, and it was 27–7 at half time”', () => {
    const id = '2026-w11-ARI-at-KC'
    expect(on(WEEK, 'KC')).toEqual(['Melanie'])
    expect(FINALS[id]).toEqual([7, 34])
    const tds = SCORING[id]!.filter((p) => /pass from Patrick Mahomes/.test(p[4]))
    expect(tds).toHaveLength(3)
    expect(tds.filter((p) => /^Travis Kelce/.test(p[4]))).toHaveLength(2)
    const half = SCORING[id]!.filter((p) => p[0] <= 2).at(-1)!
    expect(half[3]).toEqual([7, 27])
  })

  it('“Melanie has now lived through three straight weeks on the Bears with no time left on the clock, then the Bills, then the Chiefs”', () => {
    expect([9, 10, 11].map((w) => pickOf('Melanie Moeller', w)!.teamId)).toEqual([
      'CHI',
      'BUF',
      'KC',
    ])
    expect([9, 10, 11].map((w) => lost(pickOf('Melanie Moeller', w)!))).toEqual([
      false,
      false,
      false,
    ])
    expect(SCORING['2026-w09-TB-at-CHI']!.at(-1)!.slice(0, 3)).toEqual([4, '0:00', 'CHI'])
  })

  it('“Last week I told you the Chargers were 0–8. That night they won 23–20 at Baltimore. On Sunday they lost 27–24 to the Jets”', () => {
    expect(record('LAC', 9)).toBe('0-8')
    expect(FINALS['2026-w10-LAC-at-BAL']).toEqual([23, 20])
    expect(at(gameOf(10, 'LAC')!.kickoffAt)).toMatch(/^Monday/)
    expect(FINALS['2026-w11-NYJ-at-LAC']).toEqual([27, 24])
    expect(winnerOf('2026-w11-NYJ-at-LAC')).toBe('NYJ')
  })

  it('“Jacksonville, which carried three of you last week, lost 23–18 at the Giants this week … Dallas scored 51 against Tennessee, which the twenty-one of you who lost with Dallas in week 5 are welcome to take personally”', () => {
    expect(on(10, 'JAX')).toHaveLength(3)
    expect(FINALS['2026-w11-JAX-at-NYG']).toEqual([18, 23])
    expect(FINALS['2026-w11-TEN-at-DAL']).toEqual([30, 51])
    const dal5 = picksIn(5).filter((p) => p.teamId === 'DAL')
    expect(dal5).toHaveLength(21)
    expect(dal5.every(lost)).toBe(true)
  })

  it('“Nobody picked Cincinnati at Washington on Monday night, so the week was settled on Sunday. All five of you spent Cincinnati weeks ago”', () => {
    const mnf = week(WEEK).at(-1)!
    expect(mnf.id).toBe('2026-w11-CIN-at-WAS')
    expect(at(mnf.kickoffAt)).toMatch(/^Monday/)
    expect(picksIn(WEEK).filter((p) => p.gameId === mnf.id)).toEqual([])
    expect(usedByAll('CIN')).toBe(true)
  })

  it('“the first game is Green Bay at the Rams on Wednesday night, so the week locks on Wednesday, not Thursday. Thursday is Chicago at Detroit, Philadelphia at Dallas, and Kansas City at Buffalo … Nobody is on bye”', () => {
    const w12 = week(12)
    expect(w12[0]!.id).toBe('2026-w12-GB-at-LAR')
    expect(at(w12[0]!.kickoffAt)).toMatch(/^Wednesday/)
    const thursday = w12.filter((g) => at(g.kickoffAt).startsWith('Thursday, November 26'))
    expect(thursday.map((g) => g.id)).toEqual([
      '2026-w12-CHI-at-DET',
      '2026-w12-PHI-at-DAL',
      '2026-w12-KC-at-BUF',
    ])
    const playing = new Set(w12.flatMap((g) => [g.homeTeamId, g.awayTeamId]))
    expect(allTeams.filter((t) => !playing.has(t))).toEqual([])
  })

  it('“all five of you have already used both Kansas City and Buffalo”', () => {
    expect(alive).toHaveLength(5)
    expect(usedByAll('KC')).toBe(true)
    expect(usedByAll('BUF')).toBe(true)
  })

  it('“Five of you, four on your last life, Cindy on two”', () => {
    expect(alive).toHaveLength(5)
    expect(onLives(1)).toEqual(['Allison', 'Dominic', 'Melanie', 'Tracy'])
    expect(onLives(2)).toEqual(['Cindy'])
  })

  it('“DM me your week 12 pick on Teams before 6:55 PM Wednesday, November 25, five minutes before Green Bay at the Rams kicks off”', () => {
    expect(at(lockOf(12).toISOString())).toBe('Wednesday, November 25 at 6:55 PM')
    expect(at(week(12)[0]!.kickoffAt)).toBe('Wednesday, November 25 at 7:00 PM')
  })

  it('names no week 12 pick: no paragraph that names a player names their team or its opponent', () => {
    expect(paragraphs).toHaveLength(9)
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
