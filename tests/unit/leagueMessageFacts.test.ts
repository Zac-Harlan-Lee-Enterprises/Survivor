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
 * Every week 1, 2 and 3 final, as the ESPN scoreboard
 * reports them (site.api.espn.com, 2026 season type 2, weeks 1 to 3, read on
 * 2026-09-22 and 2026-09-29). The seed deliberately carries no results — the app fetches them
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
  '2026-w03-ATL-at-GB': [35, 14],
  '2026-w03-LAC-at-BUF': [16, 24],
  '2026-w03-CAR-at-CLE': [18, 21],
  '2026-w03-NYJ-at-DET': [24, 31],
  '2026-w03-HOU-at-IND': [17, 19],
  '2026-w03-KC-at-MIA': [24, 10],
  '2026-w03-TEN-at-NYG': [7, 12],
  '2026-w03-CIN-at-PIT': [27, 30],
  '2026-w03-SEA-at-WAS': [31, 33],
  '2026-w03-NE-at-JAX': [6, 35],
  '2026-w03-ARI-at-SF': [30, 36],
  '2026-w03-MIN-at-TB': [23, 16],
  '2026-w03-BAL-at-DAL': [34, 31],
  '2026-w03-LV-at-NO': [35, 27],
  '2026-w03-LAR-at-DEN': [26, 30],
  '2026-w03-PHI-at-CHI': [7, 27],
}

const WEEK = 3
const gamesById = new Map(season.games.map((g) => [g.id, g]))
const nameOf = (playerId: string) =>
  season.profiles.find((p) => p.playerId === playerId)?.displayName ?? playerId
const firstNames = (list: Pick[]) => list.map((p) => nameOf(p.playerId).split(' ')[0]).sort()
const picksIn = (week: number) => season.picks.filter((p) => p.week === week)
const picks = picksIn(WEEK)
const pickOf = (displayName: string, week: number) =>
  season.picks.find((p) => p.week === week && nameOf(p.playerId) === displayName) ?? null

const winnerOf = (gameId: string) => {
  const game = gamesById.get(gameId)
  const final = FINALS[gameId]
  if (!game || !final) throw new Error(`no final pinned for ${gameId}`)
  const [away, home] = final
  return away > home ? game.awayTeamId : game.homeTeamId
}
/** True when the pick's team lost. No ties in weeks 1–3, so this is the whole question. */
const lost = (p: Pick) => winnerOf(p.gameId) !== p.teamId

/** A team's record over the pinned finals, from the schedule. */
const record = (teamId: string) => {
  let wins = 0
  let losses = 0
  for (const [id] of Object.entries(FINALS)) {
    const g = gamesById.get(id)
    if (!g || (g.homeTeamId !== teamId && g.awayTeamId !== teamId)) continue
    if (winnerOf(id) === teamId) wins += 1
    else losses += 1
  }
  return `${wins}-${losses}`
}

/** Lives after `through`, from picks and the pinned finals: three, minus a life per loss or silence. */
const livesAfter = (through: number) => {
  const byPlayer = new Map<string, number>()
  for (const profile of season.profiles) {
    let lives = 3
    for (let week = 1; week <= through; week++) {
      const pick = season.picks.find((p) => p.playerId === profile.playerId && p.week === week)
      if (!pick || lost(pick)) lives -= 1
    }
    byPlayer.set(profile.displayName, lives)
  }
  return byPlayer
}
const lives = livesAfter(WEEK)
const onLives = (n: number) =>
  [...lives.entries()]
    .filter(([, l]) => l === n)
    .map(([name]) => name.split(' ')[0]!)
    .sort()

const note = readFileSync(
  new URL('../../src/features/league-home/LeagueMessage.tsx', import.meta.url),
  'utf8',
)

describe('the commissioner’s week 3 review states only true things', () => {
  it('says nothing about week 4 picks, which are hidden until Thursday’s kickoff', () => {
    const body = note.slice(note.indexOf('const WEEK_3_REVIEW'), note.indexOf('const NOTES'))
    // The only mention of week 4 picks allowed is the instruction to send one.
    expect(body.match(/week 4 pick/gi) ?? []).toHaveLength(1)
    expect(body).toMatch(/DM me your week 4 pick on Teams/)
  })

  it('“twenty-four of thirty survived … Nobody is out. Eight … all three … fifteen … two … seven … one”', () => {
    expect(season.profiles).toHaveLength(30)
    expect(picks).toHaveLength(30)
    expect(picks.filter((p) => !lost(p))).toHaveLength(24)
    expect(onLives(0)).toEqual([])
    expect(onLives(3)).toHaveLength(8)
    expect(onLives(2)).toHaveLength(15)
    expect(onLives(1)).toHaveLength(7)
  })

  it('“Twenty of you took Kansas City … 24–10 … Mahomes completed twenty passes … Miami … thirteen or fewer in all three”', () => {
    const kc = picks.filter((p) => p.teamId === 'KC')
    expect(kc).toHaveLength(20)
    expect(FINALS['2026-w03-KC-at-MIA']).toEqual([24, 10])
    expect(kc.some(lost)).toBe(false)
    const miami = Object.entries(FINALS)
      .filter(([id]) => id.includes('MIA'))
      .map(([id, [away, home]]) => (gamesById.get(id)?.awayTeamId === 'MIA' ? away : home))
    expect(miami).toHaveLength(3)
    expect(miami.every((pts) => pts <= 13)).toBe(true)
    expect(miami[2]).toBe(10)
  })

  it('“Joanna, James, Don and Corey took the defending champions at Washington’s home opener … 33–31”', () => {
    const sea = picks.filter((p) => p.teamId === 'SEA')
    expect(firstNames(sea)).toEqual(['Corey', 'Don', 'James', 'Joanna'])
    expect(gamesById.get(sea[0]!.gameId)?.homeTeamId).toBe('WAS')
    expect(season.games.filter((g) => g.week < WEEK && g.homeTeamId === 'WAS')).toHaveLength(0)
    expect(FINALS['2026-w03-SEA-at-WAS']).toEqual([31, 33])
    expect(sea.every(lost)).toBe(true)
  })

  it('“Corey and Don … Pittsburgh in week 1, Seattle in week 3 … both on one life”', () => {
    for (const name of ['Corey Cowell', 'Don Turner']) {
      expect(pickOf(name, 1)?.teamId).toBe('PIT')
      expect(pickOf(name, 3)?.teamId).toBe('SEA')
      expect(lives.get(name)).toBe(1)
    }
  })

  it('“Joanna has never once picked the week’s most popular team … one life left”', () => {
    for (const week of [1, 2, 3]) {
      const counts = new Map<string, number>()
      for (const p of picksIn(week)) counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1)
      const top = Math.max(...counts.values())
      const mine = pickOf('Joanna Moss', week)!.teamId
      expect(counts.get(mine), `week ${week}`).toBeLessThan(top)
    }
    expect(lives.get('Joanna Moss')).toBe(1)
  })

  it('“Phyllis was alone on Green Bay … lost 34–3 four days earlier … 35–14 … still on two lives”', () => {
    const gb = picks.filter((p) => p.teamId === 'GB')
    expect(firstNames(gb)).toEqual(['Phyllis'])
    expect(FINALS['2026-w03-ATL-at-GB']).toEqual([35, 14])
    expect(FINALS['2026-w02-CAR-at-ATL']).toEqual([34, 3])
    const sunday = new Date(gamesById.get('2026-w02-CAR-at-ATL')!.kickoffAt)
    const thursday = new Date(gamesById.get('2026-w03-ATL-at-GB')!.kickoffAt)
    const days =
      (Date.UTC(thursday.getUTCFullYear(), thursday.getUTCMonth(), thursday.getUTCDate() - 1) -
        Date.UTC(sunday.getUTCFullYear(), sunday.getUTCMonth(), sunday.getUTCDate())) /
      86_400_000
    // Thursday 7:15 PM Central is 00:15Z Friday, hence the one-day step back.
    expect(days).toBe(4)
    expect(lives.get('Phyllis Collins')).toBe(2)
  })

  it('“Joey … picked against the Chicago Bears, at Soldier Field, on Monday Night Football … 27–7 … the last … to find out … one life … Bears 2–1”', () => {
    const joey = pickOf('Joseph Tomczuk', WEEK)!
    expect(joey.teamId).toBe('PHI')
    const game = gamesById.get(joey.gameId)!
    expect(game.homeTeamId).toBe('CHI')
    const kickoff = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      weekday: 'long',
    })
    expect(kickoff.format(new Date(game.kickoffAt))).toBe('Monday')
    expect(FINALS['2026-w03-PHI-at-CHI']).toEqual([7, 27])
    const last = [...season.games.filter((g) => g.week === WEEK)].sort((a, b) =>
      b.kickoffAt.localeCompare(a.kickoffAt),
    )[0]!
    expect(last.id).toBe(joey.gameId)
    expect(lives.get('Joseph Tomczuk')).toBe(1)
    expect(record('CHI')).toBe('2-1')
  })

  it('“Nate and Melanie had San Francisco … Nate, on his last life”; “Jared … Buffalo against the Chargers … 24–16”', () => {
    expect(firstNames(picks.filter((p) => p.teamId === 'SF'))).toEqual(['Melanie', 'Nate'])
    expect(FINALS['2026-w03-ARI-at-SF']).toEqual([30, 36])
    expect(lives.get('Nate Adams')).toBe(1)
    expect(pickOf('Jared Marks', WEEK)?.teamId).toBe('BUF')
    expect(pickOf('Jared Marks', 1)?.teamId).toBe('LAC')
    expect(FINALS['2026-w03-LAC-at-BUF']).toEqual([16, 24])
    expect(lives.get('Jared Marks')).toBe(1)
  })

  it('“Jason was the only one of you on Detroit, who scored thirty-one points for the third game running”', () => {
    expect(firstNames(picks.filter((p) => p.teamId === 'DET'))).toEqual(['Jason'])
    const detroit = Object.entries(FINALS)
      .filter(([id]) => id.includes('DET'))
      .map(([id, [away, home]]) => (gamesById.get(id)?.awayTeamId === 'DET' ? away : home))
    expect(detroit).toEqual([31, 31, 31])
  })

  it('“The eight still perfect: Allison, Cindy, Dominic, Jason, Mike, Shahid, Tracy and Wesley”', () => {
    expect(onLives(3)).toEqual([
      'Allison',
      'Cindy',
      'Dominic',
      'Jason',
      'Mike',
      'Shahid',
      'Tracy',
      'Wesley',
    ])
  })

  it('“The Chargers … 0–3 … seven of us bought in back in week 1”', () => {
    expect(record('LAC')).toBe('0-3')
    expect(picksIn(1).filter((p) => p.teamId === 'LAC')).toHaveLength(7)
  })

  it('“Week 4 has no byes … KC at LV, both 3–0 … Miami … at 3–0 Minnesota … Green Bay at 0–3 Tampa Bay … cost nine of you a life … 0–3 Chargers at Seattle … Indianapolis … Washington … 8:30 … Pittsburgh at Cleveland”', () => {
    const week4 = season.games.filter((g) => g.week === 4)
    expect(new Set(week4.flatMap((g) => [g.homeTeamId, g.awayTeamId])).size).toBe(32)
    const has = (away: string, home: string) =>
      week4.some((g) => g.awayTeamId === away && g.homeTeamId === home)
    expect(has('KC', 'LV')).toBe(true)
    expect(record('KC')).toBe('3-0')
    expect(record('LV')).toBe('3-0')
    expect(has('MIA', 'MIN')).toBe(true)
    expect(record('MIN')).toBe('3-0')
    expect(has('GB', 'TB')).toBe(true)
    expect(record('TB')).toBe('0-3')
    // Seven lost on Tampa Bay in week 2; Matt (week 1) and Phyllis (week 3) lost on Green Bay.
    const wounded = new Set(
      season.picks
        .filter((p) => (p.teamId === 'TB' || p.teamId === 'GB') && lost(p))
        .map((p) => p.playerId),
    )
    expect(wounded.size).toBe(9)
    expect(has('LAC', 'SEA')).toBe(true)
    expect(record('SEA')).toBe('2-1')
    const london = week4.find((g) => g.awayTeamId === 'IND' && g.homeTeamId === 'WAS')!
    const at = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      weekday: 'long',
      hour: 'numeric',
      minute: '2-digit',
    })
    expect(at.format(new Date(london.kickoffAt))).toBe('Sunday 8:30 AM')
    const opener = [...week4].sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))[0]!
    expect([opener.awayTeamId, opener.homeTeamId]).toEqual(['PIT', 'CLE'])
  })

  it('“before 7:10 PM Thursday — five minutes before Pittsburgh at Cleveland … seven of you have exactly one”', () => {
    const opener = season.games
      .filter((g) => g.week === 4)
      .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))[0]!
    const lock = new Date(new Date(opener.kickoffAt).getTime() - 5 * 60_000)
    const central = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      weekday: 'long',
      hour: 'numeric',
      minute: '2-digit',
    }).format(lock)
    expect(central).toBe('Thursday 7:10 PM')
    expect(onLives(1)).toHaveLength(7)
  })
})
