import { readFileSync } from 'node:fs'

/**
 * The season as the fact tests see it: the seeded picks and schedule, plus every
 * final pinned from the ESPN scoreboard. Shared by leagueMessageFacts and
 * epitaphFacts so the note and the headstones are checked against one record.
 *
 * Read from disk rather than imported: tests/unit is compiled by
 * tsconfig.node.json, which does not include src.
 */
export interface Pick {
  playerId: string
  week: number
  teamId: string
  gameId: string
}
export interface Game {
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

export const season = JSON.parse(
  readFileSync(new URL('../../src/data/demo/fixtures/demo-season.json', import.meta.url), 'utf8'),
) as Season

/**
 * Every week 1–4 final, as the ESPN scoreboard
 * reports them (site.api.espn.com, 2026 season type 2, weeks 1 to 4, read on
 * 2026-09-22, 2026-09-29 and 2026-10-05; week 4's Monday night game, which nobody
 * picked, was still to be played). The seed deliberately carries no results — the app fetches them
 * live — so the note's outcome claims are pinned here instead, keyed by the
 * seed's own game ids so a pick and its result cannot drift apart.
 *
 * `[away, home]` scores, in the same order as the game id reads.
 */
export const FINALS: Record<string, [number, number]> = {
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
  '2026-w04-PIT-at-CLE': [24, 27],
  '2026-w04-IND-at-WAS': [30, 13],
  '2026-w04-NE-at-BUF': [29, 26],
  '2026-w04-NYJ-at-CHI': [12, 23],
  '2026-w04-JAX-at-CIN': [22, 17],
  '2026-w04-ARI-at-NYG': [24, 36],
  '2026-w04-LAR-at-PHI': [24, 20],
  '2026-w04-GB-at-TB': [17, 14],
  '2026-w04-TEN-at-BAL': [18, 24],
  '2026-w04-DAL-at-HOU': [34, 30],
  '2026-w04-MIA-at-MIN': [10, 15],
  '2026-w04-KC-at-LV': [30, 27],
  '2026-w04-DEN-at-SF': [14, 24],
  '2026-w04-LAC-at-SEA': [23, 30],
  '2026-w04-DET-at-CAR': [26, 32],
}

export const gamesById = new Map(season.games.map((g) => [g.id, g]))
export const nameOf = (playerId: string) =>
  season.profiles.find((p) => p.playerId === playerId)?.displayName ?? playerId
export const picksIn = (week: number) => season.picks.filter((p) => p.week === week)
export const pickOf = (displayName: string, week: number) =>
  season.picks.find((p) => p.week === week && nameOf(p.playerId) === displayName) ?? null

export const winnerOf = (gameId: string) => {
  const game = gamesById.get(gameId)
  const final = FINALS[gameId]
  if (!game || !final) throw new Error(`no final pinned for ${gameId}`)
  const [away, home] = final
  return away > home ? game.awayTeamId : game.homeTeamId
}
/** True when the pick's team lost. No ties pinned yet, so this is the whole question. */
export const lost = (p: Pick) => winnerOf(p.gameId) !== p.teamId

/** A team's record over the pinned finals, from the schedule. */
export const record = (teamId: string) => {
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

/**
 * Lives after `through`, from picks and the pinned finals: three, minus a life
 * per loss or silence, stopping at zero — the week that happens is the week
 * they went out, and later weeks ask nothing of them.
 */
export const livesAfter = (through: number) => {
  const byPlayer = new Map<string, number>()
  for (const profile of season.profiles) {
    let lives = 3
    for (let week = 1; week <= through && lives > 0; week++) {
      const pick = season.picks.find((p) => p.playerId === profile.playerId && p.week === week)
      if (!pick || lost(pick)) lives -= 1
    }
    byPlayer.set(profile.displayName, lives)
  }
  return byPlayer
}

/** The week the pinned finals put a player out, or null while they live. */
export const eliminatedWeekOf = (playerId: string, through: number): number | null => {
  let lives = 3
  for (let week = 1; week <= through; week++) {
    const pick = season.picks.find((p) => p.playerId === playerId && p.week === week)
    if (!pick || lost(pick)) lives -= 1
    if (lives === 0) return week
  }
  return null
}

/**
 * The last week whose record is complete for the league's purposes: every game
 * somebody picked has its final pinned. A game nobody picked cannot move a
 * life, so it may still be unplayed.
 */
export const pinnedThrough = (() => {
  let week = 0
  for (;;) {
    const next = week + 1
    const picked = new Set(picksIn(next).map((p) => p.gameId))
    if (picked.size === 0 || ![...picked].every((id) => id in FINALS)) return week
    week = next
  }
})()
