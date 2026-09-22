import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The commissioner's note states numbers about the league, and the league is
 * read by the people those numbers are about. A stat that has quietly gone
 * stale — one more pick arrives and "eleven of you" becomes twelve — is worse
 * than no stat, because it is the kind of wrong nobody checks until someone is
 * annoyed about their own name.
 *
 * So every counted claim in the current note is asserted here against the
 * season it describes. When these fail, the note needs rewriting: that is the
 * signal working, not a broken test.
 *
 * Read from disk rather than imported, like cropNudges.test.ts next door:
 * tests/unit is compiled by tsconfig.node.json, which does not include src.
 */
interface Pick {
  playerId: string
  week: number
  teamId: string
  gameId: string
}
interface Game {
  id: string
  week: number
  homeTeamId: string
  awayTeamId: string
  kickoffAt: string
}
interface Season {
  picks: Pick[]
  games: Game[]
  profiles: { playerId: string; displayName: string }[]
  memberships: { playerId: string; role: string }[]
}

const season = JSON.parse(
  readFileSync(new URL('../../src/data/demo/fixtures/demo-season.json', import.meta.url), 'utf8'),
) as Season

/**
 * Every week 1 and week 2 final, as the ESPN scoreboard
 * reports them (site.api.espn.com, 2026 season type 2, weeks 1 and 2, read on
 * 2026-09-22). The seed deliberately carries no results — the app fetches them
 * live — so the note's outcome claims are pinned here instead, keyed by the
 * seed's own game ids so a pick and its result cannot drift apart.
 *
 * `[away, home]` scores, in the same order as the game id reads.
 */
const FINALS: Record<string, [number, number]> = {
  '2026-w01-NE-at-SEA': [10, 13],
  '2026-w01-SF-at-LAR': [27, 7],
  '2026-w01-TB-at-CIN': [27, 33],
  '2026-w01-NO-at-DET': [30, 31],
  '2026-w01-NYJ-at-TEN': [23, 10],
  '2026-w01-BAL-at-IND': [41, 23],
  '2026-w01-ATL-at-PIT': [13, 20],
  '2026-w01-CHI-at-CAR': [59, 37],
  '2026-w01-CLE-at-JAX': [10, 34],
  '2026-w01-BUF-at-HOU': [36, 31],
  '2026-w01-MIA-at-LV': [13, 27],
  '2026-w01-GB-at-MIN': [22, 39],
  '2026-w01-WAS-at-PHI': [22, 24],
  '2026-w01-ARI-at-LAC': [26, 14],
  '2026-w01-DAL-at-NYG': [20, 28],
  '2026-w01-DEN-at-KC': [10, 31],
  '2026-w02-DET-at-BUF': [31, 41],
  '2026-w02-CAR-at-ATL': [34, 3],
  '2026-w02-MIN-at-CHI': [9, 3],
  '2026-w02-PHI-at-TEN': [24, 20],
  '2026-w02-PIT-at-NE': [3, 20],
  '2026-w02-GB-at-NYJ': [20, 17],
  '2026-w02-CLE-at-TB': [23, 19],
  '2026-w02-NO-at-BAL': [24, 17],
  '2026-w02-CIN-at-HOU': [20, 6],
  '2026-w02-JAX-at-DEN': [13, 20],
  '2026-w02-LV-at-LAC': [26, 14],
  '2026-w02-WAS-at-DAL': [20, 37],
  '2026-w02-SEA-at-ARI': [31, 7],
  '2026-w02-MIA-at-SF': [13, 35],
  '2026-w02-IND-at-KC': [30, 33],
  '2026-w02-NYG-at-LAR': [6, 28],
}

const WEEK = 2
const picks = season.picks.filter((p) => p.week === WEEK)
const gamesById = new Map(season.games.map((g) => [g.id, g]))
const countOn = (teamId: string) => picks.filter((p) => p.teamId === teamId).length
const nameOf = (playerId: string) =>
  season.profiles.find((p) => p.playerId === playerId)?.displayName ?? playerId
const firstNames = (list: Pick[]) => list.map((p) => nameOf(p.playerId).split(' ')[0]).sort()
const pickBy = (displayName: string) => picks.find((p) => nameOf(p.playerId) === displayName) ?? null
const week1PickOf = (displayName: string) =>
  season.picks.find((p) => p.week === 1 && nameOf(p.playerId) === displayName) ?? null

const winnerOf = (gameId: string) => {
  const game = gamesById.get(gameId)
  const final = FINALS[gameId]
  if (!game || !final) throw new Error(`no final pinned for ${gameId}`)
  const [away, home] = final
  return away > home ? game.awayTeamId : game.homeTeamId
}
/** True when the pick's team lost. No ties in either week, so this is the whole question. */
const lost = (p: Pick) => winnerOf(p.gameId) !== p.teamId
const isHome = (p: Pick) => gamesById.get(p.gameId)?.homeTeamId === p.teamId

/** Lives after week 2, from picks and the pinned finals: three, minus a life per loss or silence. */
const livesAfterWeek2 = () => {
  const byPlayer = new Map<string, number>()
  for (const profile of season.profiles) {
    let lives = 3
    for (const week of [1, 2]) {
      const pick = season.picks.find((p) => p.playerId === profile.playerId && p.week === week)
      if (!pick || lost(pick)) lives -= 1
    }
    byPlayer.set(profile.displayName, lives)
  }
  return byPlayer
}

describe('the commissioner’s week 2 review states only true things', () => {
  it('“fourteen of you are a life lighter … ten … all three, seventeen … two, three … last one”', () => {
    const lives = livesAfterWeek2()
    const tally = (n: number) => [...lives.values()].filter((l) => l === n).length
    expect(tally(3)).toBe(10)
    expect(tally(2)).toBe(17)
    expect(tally(1)).toBe(3)
    expect(tally(0)).toBe(0) // "Nobody is out."
    const lostThisWeek = season.profiles.filter((profile) => {
      const pick = picks.find((p) => p.playerId === profile.playerId)
      return !pick || lost(pick)
    })
    expect(lostThisWeek).toHaveLength(14)
  })

  it('“Eleven of you ordered San Francisco” — and they won 35–13', () => {
    expect(countOn('SF')).toBe(11)
    const sf = picks.find((p) => p.teamId === 'SF')!
    expect(FINALS[sf.gameId]).toEqual([13, 35])
    expect(lost(sf)).toBe(false)
  })

  it('“Seven of you were on the Buccaneers at home to Cleveland” — 23–19, and Tony alone on the Browns', () => {
    const tb = picks.filter((p) => p.teamId === 'TB')
    expect(tb).toHaveLength(7)
    expect(firstNames(tb)).toEqual(['Chloe', 'Corey', 'Joseph', 'KC', 'Nate', 'Paul', 'Sheila'])
    expect(tb.every(isHome)).toBe(true)
    expect(tb.every(lost)).toBe(true)
    const tony = pickBy('Tony Canody')!
    expect(tony.teamId).toBe('CLE')
    expect(tony.gameId).toBe(tb[0]!.gameId)
    expect(FINALS[tony.gameId]).toEqual([23, 19])
    expect(picks.filter((p) => p.teamId === 'CLE')).toHaveLength(1)
  })

  it('“Dave, Don and Maya took Baltimore at home … lost 24–17”', () => {
    const bal = picks.filter((p) => p.teamId === 'BAL')
    expect(firstNames(bal)).toEqual(['Dave', 'Don', 'Maya'])
    expect(bal.every(isHome)).toBe(true)
    expect(FINALS[bal[0]!.gameId]).toEqual([24, 17])
    expect(bal.every(lost)).toBe(true)
  })

  it('“Bradley took Chicago … Minnesota 9, Chicago 3”, Detroit before it, Minnesota and Green Bay both won', () => {
    const bradley = pickBy('Bradley Riedell')!
    expect(bradley.teamId).toBe('CHI')
    expect(FINALS[bradley.gameId]).toEqual([9, 3])
    expect(lost(bradley)).toBe(true)
    expect(week1PickOf('Bradley Riedell')?.teamId).toBe('DET')
    expect(winnerOf('2026-w02-MIN-at-CHI')).toBe('MIN')
    expect(winnerOf('2026-w02-GB-at-NYJ')).toBe('GB')
  })

  it('“Only two of you left the house” — Melanie and Tony, both won; “Eleven of the twenty-five home picks did not”', () => {
    const away = picks.filter((p) => !isHome(p))
    expect(firstNames(away)).toEqual(['Melanie', 'Tony'])
    expect(away.some(lost)).toBe(false)
    const melanie = pickBy('Melanie Moeller')!
    expect(melanie.teamId).toBe('PHI')
    expect(gamesById.get(melanie.gameId)?.homeTeamId).toBe('TEN')
    expect(FINALS[melanie.gameId]).toEqual([24, 20])
    const home = picks.filter(isHome)
    expect(home).toHaveLength(25)
    expect(home.filter(lost)).toHaveLength(11)
  })

  it('“Joanna, Allison and Phyllis were on Buffalo” — 41–31; Allison’s week 1 team was Detroit', () => {
    const buf = picks.filter((p) => p.teamId === 'BUF')
    expect(firstNames(buf)).toEqual(['Allison', 'Joanna', 'Phyllis'])
    expect(FINALS[buf[0]!.gameId]).toEqual([31, 41])
    expect(buf.every(lost)).toBe(false)
    expect(week1PickOf('Allison Petty')?.teamId).toBe('DET')
    expect(gamesById.get(buf[0]!.gameId)?.awayTeamId).toBe('DET')
  })

  it('“Three picks did not arrive … Jared, Tina and Craig”', () => {
    const answered = new Set(picks.map((p) => p.playerId))
    const silent = season.profiles
      .filter((p) => !answered.has(p.playerId))
      .map((p) => p.displayName.split(' ')[0])
      .sort()
    expect(silent).toEqual(['Craig', 'Jared', 'Tina'])
  })

  it('“Jared and Craig … the Chargers in week 1 … along with Nate … the three down to a single life”', () => {
    const lives = livesAfterWeek2()
    const onOne = [...lives.entries()].filter(([, l]) => l === 1).map(([name]) => name.split(' ')[0])
    expect(onOne.sort()).toEqual(['Craig', 'Jared', 'Nate'])
    expect(week1PickOf('Jared Marks')?.teamId).toBe('LAC')
    expect(week1PickOf('Craig Mowers')?.teamId).toBe('LAC')
    expect(week1PickOf('Nate Adams')?.teamId).toBe('LAC')
    expect(pickBy('Nate Adams')?.teamId).toBe('TB')
  })

  it('“the seven of us buried by the Chargers … 26–14 to Arizona … 26–14 to the Raiders”', () => {
    const week1 = season.picks.filter((p) => p.week === 1)
    const chargers = week1.filter((p) => p.teamId === 'LAC')
    expect(chargers).toHaveLength(7)
    const commissioner = season.memberships.find((m) => m.role === 'commissioner')!
    expect(chargers.map((p) => p.playerId)).toContain(commissioner.playerId)
    expect(FINALS['2026-w01-ARI-at-LAC']).toEqual([26, 14])
    expect(FINALS['2026-w02-LV-at-LAC']).toEqual([26, 14])
    expect(chargers.every(lost)).toBe(true)
  })

  it('“Week 3 has no byes either … The Chargers visit Buffalo … Arizona … visits San Francisco … Thursday night is Atlanta at Green Bay”', () => {
    const week3 = season.games.filter((g) => g.week === 3)
    expect(new Set(week3.flatMap((g) => [g.homeTeamId, g.awayTeamId])).size).toBe(32)
    const fixture = (away: string, home: string) =>
      week3.find((g) => g.awayTeamId === away && g.homeTeamId === home)
    expect(fixture('LAC', 'BUF')).toBeDefined()
    expect(fixture('ARI', 'SF')).toBeDefined()
    const opener = [...week3].sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))[0]!
    expect(opener.awayTeamId).toBe('ATL')
    expect(opener.homeTeamId).toBe('GB')
    // "Atlanta lost 34–3 to Carolina on Sunday."
    expect(FINALS['2026-w02-CAR-at-ATL']).toEqual([34, 3])
    expect(gamesById.get('2026-w02-CAR-at-ATL')?.kickoffAt.startsWith('2026-09-20')).toBe(true)
  })

  it('“Picks lock at 7:10 PM Thursday, five minutes before Atlanta at Green Bay” — in the commissioner’s Central time', () => {
    const opener = season.games
      .filter((g) => g.week === 3)
      .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))[0]!
    const lock = new Date(new Date(opener.kickoffAt).getTime() - 5 * 60_000)
    const central = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      weekday: 'long',
      hour: 'numeric',
      minute: '2-digit',
    }).format(lock)
    expect(central).toBe('Thursday 7:10 PM')
  })
})
