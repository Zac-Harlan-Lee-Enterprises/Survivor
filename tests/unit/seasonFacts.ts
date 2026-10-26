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
  submittedAt: string
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
 * Every week 1–7 final, as the ESPN scoreboard
 * reports them (site.api.espn.com, 2026 season type 2, weeks 1 to 4, read on
 * 2026-09-22, 2026-09-29 and 2026-10-05, Monday night's added on 2026-10-09; week 5 read 2026-10-13;
 * week 6 read 2026-10-20;
 * week 7 read 2026-10-26, before Monday night's DAL at PHI, which nobody picked). The seed deliberately carries no results — the app fetches them
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
  '2026-w04-ATL-at-NO': [45, 24],
  '2026-w05-TB-at-DAL': [24, 16],
  '2026-w05-PHI-at-JAX': [17, 19],
  '2026-w05-CHI-at-GB': [7, 31],
  '2026-w05-HOU-at-TEN': [26, 3],
  '2026-w05-CIN-at-MIA': [31, 24],
  '2026-w05-LV-at-NE': [17, 45],
  '2026-w05-MIN-at-NO': [23, 13],
  '2026-w05-CLE-at-NYJ': [12, 17],
  '2026-w05-IND-at-PIT': [22, 34],
  '2026-w05-NYG-at-WAS': [27, 27],
  '2026-w05-DEN-at-LAC': [23, 17],
  '2026-w05-DET-at-ARI': [45, 21],
  '2026-w05-SF-at-SEA': [32, 29],
  '2026-w05-BAL-at-ATL': [30, 23],
  '2026-w05-BUF-at-LAR': [37, 34],
  '2026-w06-SEA-at-DEN': [14, 17],
  '2026-w06-HOU-at-JAX': [34, 31],
  '2026-w06-CHI-at-ATL': [31, 23],
  '2026-w06-BAL-at-CLE': [10, 13],
  '2026-w06-TEN-at-IND': [26, 20],
  '2026-w06-NYJ-at-NE': [19, 26],
  '2026-w06-NO-at-NYG': [34, 27],
  '2026-w06-CAR-at-PHI': [25, 14],
  '2026-w06-PIT-at-TB': [26, 19],
  '2026-w06-ARI-at-LAR': [18, 16],
  '2026-w06-LAC-at-KC': [6, 22],
  '2026-w06-BUF-at-LV': [33, 30],
  '2026-w06-DAL-at-GB': [13, 23],
  '2026-w06-WAS-at-SF': [17, 23],
  '2026-w07-NE-at-CHI': [24, 30],
  '2026-w07-PIT-at-NO': [16, 10],
  '2026-w07-SF-at-ATL': [20, 29],
  '2026-w07-CLE-at-TEN': [27, 24],
  '2026-w07-IND-at-MIN': [10, 16],
  '2026-w07-MIA-at-NYJ': [28, 25],
  '2026-w07-TB-at-CAR': [43, 13],
  '2026-w07-CIN-at-BAL': [35, 13],
  '2026-w07-NYG-at-HOU': [27, 21],
  '2026-w07-DEN-at-ARI': [30, 16],
  '2026-w07-GB-at-DET': [17, 20],
  '2026-w07-LAR-at-LV': [35, 21],
  '2026-w07-KC-at-SEA': [3, 20],
}

/**
 * The scoring plays of the games a note or an epitaph tells the story of, as
 * the ESPN game summary lists them (site.api.espn.com summary, read
 * 2026-10-20): quarter, game clock, scoring team, the score after it
 * `[away, home]`, and ESPN's description.
 */
export type ScoringPlay = [
  quarter: number,
  clock: string,
  team: string,
  score: [number, number],
  text: string,
]
export const SCORING: Record<string, ScoringPlay[]> = {
  '2026-w06-ARI-at-LAR': [
    [1, '9:41', 'LAR', [0, 3], 'Blake Grupe 44 Yd Field Goal'],
    [1, '5:37', 'ARI', [3, 3], 'Chad Ryland 34 Yd Field Goal'],
    [2, '14:51', 'ARI', [6, 3], 'Chad Ryland 30 Yd Field Goal'],
    [
      2,
      '8:23',
      'LAR',
      [6, 9],
      'Blake Corum 15 Yd pass from Matthew Stafford (Two-Point Pass Conversion Failed)',
    ],
    [2, '0:46', 'ARI', [9, 9], 'Chad Ryland 22 Yd Field Goal'],
    [3, '6:25', 'ARI', [12, 9], 'Chad Ryland 38 Yd Field Goal'],
    [4, '9:28', 'ARI', [15, 9], 'Chad Ryland 27 Yd Field Goal'],
    [
      4,
      '0:47',
      'LAR',
      [15, 16],
      'Colby Parkinson 6 Yd pass from Matthew Stafford (Ethan Evans Kick)',
    ],
    [4, '0:00', 'ARI', [18, 16], 'Chad Ryland 43 Yd Field Goal'],
  ],
  '2026-w06-TEN-at-IND': [
    [2, '11:07', 'IND', [0, 7], 'Mo Alie-Cox 1 Yd pass from Daniel Jones (Spencer Shrader Kick)'],
    [2, '2:06', 'IND', [0, 10], 'Spencer Shrader 23 Yd Field Goal'],
    [2, '0:11', 'IND', [0, 13], 'Spencer Shrader 47 Yd Field Goal'],
    [3, '13:30', 'TEN', [3, 13], 'Joey Slye 29 Yd Field Goal'],
    [3, '3:21', 'TEN', [6, 13], 'Joey Slye 56 Yd Field Goal'],
    [4, '13:00', 'TEN', [13, 13], 'Carnell Tate 8 Yd pass from Cam Ward (Joey Slye Kick)'],
    [4, '10:17', 'TEN', [20, 13], 'Oluwafemi Oladejo 14 Yd return of blocked punt (J.Slye kick)'],
    [4, '5:32', 'IND', [20, 20], 'Jonathan Taylor 4 Yd Rush (Spencer Shrader Kick)'],
    [4, '2:03', 'TEN', [23, 20], 'Joey Slye 49 Yd Field Goal'],
    [4, '0:43', 'TEN', [26, 20], 'Joey Slye 44 Yd Field Goal'],
  ],
  '2026-w06-NYJ-at-NE': [
    [1, '8:17', 'NYJ', [3, 0], 'Jason Sanders 42 Yd Field Goal'],
    [1, '4:10', 'NE', [3, 7], 'Romeo Doubs 42 Yd pass from Drake Maye (Andy Borregales Kick)'],
    [2, '1:46', 'NE', [3, 10], 'Andy Borregales 32 Yd Field Goal'],
    [2, '0:14', 'NE', [3, 17], 'DeMario Douglas 9 Yd pass from Drake Maye (Andy Borregales Kick)'],
    [
      3,
      '10:24',
      'NYJ',
      [10, 17],
      'Omar Cooper Jr. 48 Yd pass from Geno Smith (Jason Sanders Kick)',
    ],
    [3, '4:46', 'NYJ', [13, 17], 'Jason Sanders 36 Yd Field Goal'],
    [
      4,
      '14:10',
      'NE',
      [13, 23],
      'Hunter Henry 7 Yd pass from Drake Maye (Andy Borregales PAT Failed)',
    ],
    [4, '7:20', 'NYJ', [16, 23], 'Jason Sanders 40 Yd Field Goal'],
    [4, '1:12', 'NE', [16, 26], 'Andy Borregales 27 Yd Field Goal'],
    [4, '0:32', 'NYJ', [19, 26], 'Jason Sanders 36 Yd Field Goal'],
  ],
  '2026-w07-NYG-at-HOU': [
    [1, '11:40', 'HOU', [0, 3], "Ka'imi Fairbairn 58 Yd Field Goal"],
    [1, '6:26', 'NYG', [7, 3], 'Tyrone Tracy Jr. 2 Yd Rush (Dominic Zvada Kick)'],
    [2, '9:03', 'HOU', [7, 6], "Ka'imi Fairbairn 57 Yd Field Goal"],
    [2, '3:32', 'NYG', [14, 6], 'Jameis Winston 1 Yd Rush (Dominic Zvada Kick)'],
    [
      2,
      '0:34',
      'HOU',
      [14, 14],
      'Marvin Harrison Jr. 6 Yd pass from C.J. Stroud (C.J. Stroud Pass to Cade Stover for Two-Point Conversion)',
    ],
    [4, '8:55', 'NYG', [21, 14], 'Cam Skattebo 16 Yd Rush (Dominic Zvada Kick)'],
    [
      4,
      '0:52',
      'HOU',
      [21, 21],
      "Xavier Hutchinson 3 Yd pass from C.J. Stroud (Ka'imi Fairbairn Kick)",
    ],
    [5, '7:25', 'NYG', [27, 21], 'Devin Singletary 30 Yd Rush'],
  ],
  '2026-w07-TB-at-CAR': [
    [1, '7:22', 'TB', [7, 0], 'Bucky Irving 4 Yd Rush (Chase McLaughlin Kick)'],
    [2, '14:12', 'TB', [10, 0], 'Chase McLaughlin 22 Yd Field Goal'],
    [2, '11:05', 'TB', [17, 0], 'Calijah Kancey 32 Yd Fumble Return (Chase McLaughlin Kick)'],
    [
      2,
      '9:09',
      'CAR',
      [17, 6],
      'Darren Waller 50 Yd pass from Bryce Young (Ryan Fitzgerald PAT blocked)',
    ],
    [2, '9:09', 'TB', [19, 6], 'Zyon McCollum Defensive PAT Conversion'],
    [2, '3:53', 'TB', [26, 6], 'Bucky Irving 1 Yd Rush (Chase McLaughlin Kick)'],
    [
      2,
      '0:04',
      'TB',
      [33, 6],
      'Tez Johnson 14 Yd pass from Baker Mayfield (Chase McLaughlin Kick)',
    ],
    [3, '6:30', 'TB', [36, 6], 'Chase McLaughlin 44 Yd Field Goal'],
    [4, '10:21', 'TB', [43, 6], 'Sean Tucker 46 Yd Rush (Chase McLaughlin Kick)'],
    [4, '5:28', 'CAR', [43, 13], 'Anthony Tyus III 12 Yd Rush (Ryan Fitzgerald Kick)'],
  ],
}

/** Turnovers each side committed (ESPN box score, read 2026-10-26), for the games a note uses. */
export const TURNOVERS: Record<string, Record<string, number>> = {
  '2026-w07-TB-at-CAR': { TB: 0, CAR: 4 },
  '2026-w07-SF-at-ATL': { SF: 4, ATL: 0 },
}

/**
 * Box-score lines from the same ESPN game summaries (team statistics and the
 * players' passing and kicking lines, read 2026-10-20), for the games the
 * notes tell the story of. Only what a note or an epitaph actually uses.
 */
export interface TeamBox {
  totalYards: number
  firstDowns: number
  passingYards: number
  /** Red-zone trips that ended in a touchdown, and trips. */
  redZone: [made: number, trips: number]
}
export interface PlayerBox {
  team: string
  completions?: number
  attempts?: number
  passingYards?: number
  touchdowns?: number
  interceptions?: number
  fieldGoals?: [made: number, tried: number]
  longest?: number
  points?: number
}
export const BOX: Record<
  string,
  { teams: Record<string, TeamBox>; players: Record<string, PlayerBox> }
> = {
  '2026-w06-ARI-at-LAR': {
    teams: {
      ARI: { totalYards: 338, firstDowns: 22, passingYards: 218, redZone: [0, 5] },
      LAR: { totalYards: 286, firstDowns: 19, passingYards: 194, redZone: [2, 4] },
    },
    players: {
      'Jacoby Brissett': {
        team: 'ARI',
        completions: 24,
        attempts: 35,
        passingYards: 218,
        touchdowns: 0,
        interceptions: 1,
      },
      'Matthew Stafford': {
        team: 'LAR',
        completions: 25,
        attempts: 33,
        passingYards: 222,
        touchdowns: 2,
        interceptions: 0,
      },
      'Chad Ryland': { team: 'ARI', fieldGoals: [6, 6], longest: 43, points: 18 },
    },
  },
  '2026-w06-TEN-at-IND': {
    teams: {
      TEN: { totalYards: 186, firstDowns: 11, passingYards: 102, redZone: [1, 2] },
      IND: { totalYards: 399, firstDowns: 24, passingYards: 234, redZone: [2, 4] },
    },
    players: {
      'Cam Ward': {
        team: 'TEN',
        completions: 11,
        attempts: 22,
        passingYards: 102,
        touchdowns: 1,
        interceptions: 1,
      },
      'Daniel Jones': {
        team: 'IND',
        completions: 22,
        attempts: 42,
        passingYards: 269,
        touchdowns: 1,
        interceptions: 2,
      },
      'Joey Slye': { team: 'TEN', fieldGoals: [4, 4], longest: 56, points: 14 },
    },
  },
}

export const gamesById = new Map(season.games.map((g) => [g.id, g]))
export const nameOf = (playerId: string) =>
  season.profiles.find((p) => p.playerId === playerId)?.displayName ?? playerId
export const picksIn = (week: number) => season.picks.filter((p) => p.week === week)
export const pickOf = (displayName: string, week: number) =>
  season.picks.find((p) => p.week === week && nameOf(p.playerId) === displayName) ?? null

/** The winning team, or null for a tie (which, by the league's rules, costs a life like a loss). */
export const winnerOf = (gameId: string): string | null => {
  const game = gamesById.get(gameId)
  const final = FINALS[gameId]
  if (!game || !final) throw new Error(`no final pinned for ${gameId}`)
  const [away, home] = final
  if (away === home) return null
  return away > home ? game.awayTeamId : game.homeTeamId
}
/** True when the pick cost a life: its team lost, or tied. */
export const lost = (p: Pick) => winnerOf(p.gameId) !== p.teamId

/** How many of the league picked a team in a week. */
export const crowd = (week: number, teamId: string) =>
  picksIn(week).filter((p) => p.teamId === teamId).length

/**
 * A team's record over the pinned finals, from the schedule: "4-1", or "1-3-1"
 * with a tie. Through week `through` when given (a record as it stood then).
 */
export const record = (teamId: string, through = Infinity) => {
  let wins = 0
  let losses = 0
  let ties = 0
  for (const [id] of Object.entries(FINALS)) {
    const g = gamesById.get(id)
    if (!g || g.week > through || (g.homeTeamId !== teamId && g.awayTeamId !== teamId)) continue
    const winner = winnerOf(id)
    if (winner === null) ties += 1
    else if (winner === teamId) wins += 1
    else losses += 1
  }
  return ties ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`
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
