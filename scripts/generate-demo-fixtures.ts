/**
 * Generates src/data/demo/fixtures/demo-season.json — the seed the app loads
 * in demo mode.
 *
 * REAL: the roster and their week 1 picks, supplied by the commissioner.
 * SYNTHETIC: the schedule (matchups, kickoff times, bye weeks). The real NFL
 * fixture list is not known here and is never invented as fact — the season
 * is flagged isSynthetic so the UI says so.
 * ABSENT: results. None were supplied, so none are fabricated; every pick is
 * pending and every player still holds all three lives.
 *
 * Deterministic (seeded PRNG) so the app, the tests and the screenshots agree.
 *
 * Run: npm run fixtures:generate
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ALL_TEAM_IDS } from '../src/domain/teams'
import {
  SeasonSnapshotSchema,
  type LeagueMembership,
  type NFLGame,
  type NFLWeek,
  type Pick,
  type PlayerImage,
  type PlayerProfile,
  type SeasonSnapshot,
} from '../src/domain/models'

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260910)
function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}
const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1))

// ---------------------------------------------------------------------------
// Time: kickoffs are expressed in US Eastern and stored in UTC.
// ---------------------------------------------------------------------------
const TZ = 'America/New_York'
function tzOffsetMs(utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  )
  return asUtc - Math.floor(utcMs / 1000) * 1000
}
function easternToUtc(y: number, m: number, d: number, h: number, min: number): string {
  const naive = Date.UTC(y, m - 1, d, h, min)
  let guess = naive
  for (let i = 0; i < 3; i++) guess = naive - tzOffsetMs(guess)
  return new Date(guess).toISOString()
}
/** Sunday of week N (week 1 = 13 Sep 2026). */
function sundayOf(week: number): [number, number, number] {
  const d = new Date(Date.UTC(2026, 8, 13 + (week - 1) * 7))
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]
}
function dayOffset([y, m, d]: [number, number, number], days: number): [number, number, number] {
  const x = new Date(Date.UTC(y, m - 1, d + days))
  return [x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()]
}
type Slot = 'TNF' | 'SUN_EARLY' | 'SUN_LATE' | 'SNF' | 'MNF'
function kickoff(week: number, slot: Slot): string {
  const sun = sundayOf(week)
  switch (slot) {
    case 'TNF': {
      const [y, m, d] = dayOffset(sun, -3)
      return easternToUtc(y, m, d, 20, 15)
    }
    case 'SUN_EARLY':
      return easternToUtc(...sun, 13, 0)
    case 'SUN_LATE':
      return easternToUtc(...sun, 16, 25)
    case 'SNF':
      return easternToUtc(...sun, 20, 20)
    case 'MNF': {
      const [y, m, d] = dayOffset(sun, 1)
      return easternToUtc(y, m, d, 20, 15)
    }
  }
}

// ---------------------------------------------------------------------------
// The roster (real league members) and the state of the season
//
// The PEOPLE and their week 1 picks are REAL, supplied by the commissioner.
// The SCHEDULE below is still synthetic — the real NFL fixture list is not
// known here and is never invented as fact, which is why the season carries
// isSynthetic: true and the app shows a banner saying so.
//
// No results are recorded, because none were supplied. Every week 1 pick is
// pending, every player has all three lives, and nothing has been fabricated
// about how anyone is doing. Enter real results in Commissioner → Results
// (or connect a provider) and the standings compute themselves.
// ---------------------------------------------------------------------------
const SEASON_YEAR = 2026
const LEAGUE_ID = 'demo-league'
const SEASON_ID = 'demo-2026'
const CREATED = '2026-08-15T14:00:00.000Z'

interface Person {
  id: string
  name: string
  /** Left unset on purpose: inventing nicknames or personality for real people
   *  would be fabrication. The commissioner can add them in the app. */
  nickname?: string
  tagline?: string
  role: LeagueMembership['role']
  hasImage: boolean
}
const PEOPLE: Person[] = [
  { id: 'maya-israel', name: 'Maya Israel', role: 'player', hasImage: true },
  { id: 'shahid-ali', name: 'Shahid Ali', role: 'player', hasImage: true },
  { id: 'dave-johnson', name: 'Dave Johnson', role: 'player', hasImage: true },
  { id: 'james-parker', name: 'James Parker', role: 'player', hasImage: true },
  { id: 'nate-adams', name: 'Nate Adams', role: 'player', hasImage: true },
  { id: 'stacey-markendorff', name: 'Stacey Markendorff', role: 'player', hasImage: true },
  { id: 'sheila-acker', name: 'Sheila Acker', role: 'player', hasImage: true },
  { id: 'dominic-green', name: 'Dominic Green', role: 'player', hasImage: true },
  // Commissioner: runs the league and holds the admin tools.
  { id: 'zac-harlan', name: 'Zac Harlan', role: 'commissioner', hasImage: true },
]

/** [team, outcome]. W = win, L = loss, T = tie, P = pending. null = no pick. */
type Outcome = 'W' | 'L' | 'T' | 'P'
type Story = Record<string, Record<number, [string, Outcome] | null>>

/** Week 1 picks exactly as supplied. Every outcome is pending: no result is invented. */
const STORY: Story = {
  'maya-israel': { 1: ['JAX', 'P'] },
  'shahid-ali': { 1: ['BAL', 'P'] },
  'dave-johnson': { 1: ['DET', 'P'] },
  'james-parker': { 1: ['DET', 'P'] },
  'nate-adams': { 1: ['LAC', 'P'] },
  'stacey-markendorff': { 1: ['LAC', 'P'] },
  'sheila-acker': { 1: ['SEA', 'P'] },
  'dominic-green': { 1: ['BAL', 'P'] },
  'zac-harlan': { 1: ['LAC', 'P'] },
}

/**
 * Weeks whose results should be seeded as final. EMPTY on purpose: no results
 * were supplied, so none are invented. Add a week number here only alongside
 * real outcomes in STORY (W/L/T), or better, enter results in the app.
 */
const RESOLVED_WEEKS = new Set<number>()

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------
const byeOrder = shuffle(ALL_TEAM_IDS)
const BYE_WEEKS = [5, 6, 7, 8, 9, 10, 11, 12]
const byes = new Map<number, string[]>()
BYE_WEEKS.forEach((w, i) => byes.set(w, byeOrder.slice(i * 4, i * 4 + 4)))

const games: NFLGame[] = []
const weeks: NFLWeek[] = []

for (let week = 1; week <= 18; week++) {
  const byeTeams = byes.get(week) ?? []
  const wanted = new Map<string, Outcome>()
  for (const story of Object.values(STORY)) {
    const entry = story[week]
    if (entry) wanted.set(entry[0], entry[1])
  }
  const playing = ALL_TEAM_IDS.filter((t) => !byeTeams.includes(t))
  const picked = playing.filter((t) => wanted.has(t))
  const others = shuffle(playing.filter((t) => !wanted.has(t)))
  const pairs: Array<[string, string]> = []
  for (const team of picked) {
    const opp = others.pop()
    if (!opp) throw new Error(`week ${week}: not enough opponents`)
    pairs.push(rand() < 0.5 ? [team, opp] : [opp, team])
  }
  while (others.length >= 2) {
    const a = others.pop()!
    const b = others.pop()!
    pairs.push([a, b])
  }
  if (others.length !== 0) throw new Error(`week ${week}: odd team count`)

  const ordered = shuffle(pairs)
  const slots: Slot[] = ordered.map((_, i) =>
    i === 0 ? 'TNF' : i === 1 ? 'SNF' : i === 2 ? 'MNF' : i <= 5 ? 'SUN_LATE' : 'SUN_EARLY',
  )

  ordered.forEach(([home, away], i) => {
    const slot = slots[i]!
    const id = `${SEASON_YEAR}-w${String(week).padStart(2, '0')}-${away}-at-${home}`
    const base: NFLGame = {
      id,
      seasonYear: SEASON_YEAR,
      week,
      homeTeamId: home,
      awayTeamId: away,
      kickoffAt: kickoff(week, slot),
      status: 'scheduled',
      resultVersion: 0,
      updatedAt: CREATED,
    }
    const decideFinal = RESOLVED_WEEKS.has(week)
    if (decideFinal) {
      const wantHome = wanted.get(home)
      const wantAway = wanted.get(away)
      let winner: string | null
      if (wantHome === 'T' || wantAway === 'T') winner = null
      else if (wantHome === 'W' || wantAway === 'L') winner = home
      else if (wantAway === 'W' || wantHome === 'L') winner = away
      else winner = rand() < 0.55 ? home : away
      let homeScore: number
      let awayScore: number
      if (winner === null) {
        homeScore = awayScore = between(17, 27)
      } else {
        const win = between(17, 38)
        const lose = between(3, win - 3)
        ;[homeScore, awayScore] = winner === home ? [win, lose] : [lose, win]
      }
      games.push({
        ...base,
        status: 'final',
        homeScore,
        awayScore,
        winnerTeamId: winner,
        resultVersion: 1,
        resultSource: 'provider',
        updatedAt: new Date(new Date(base.kickoffAt).getTime() + 3.5 * 3_600_000).toISOString(),
      })
    } else {
      games.push(base)
    }
  })

  weeks.push({ seasonYear: SEASON_YEAR, week, label: `Week ${week}`, byeTeamIds: byeTeams })
}

// ---------------------------------------------------------------------------
// People, picks, images
// ---------------------------------------------------------------------------
const memberships: LeagueMembership[] = PEOPLE.map((p) => ({
  id: `m-${p.id}`,
  leagueId: LEAGUE_ID,
  seasonId: SEASON_ID,
  playerId: p.id,
  role: p.role,
  status: 'active',
  joinedAt: CREATED,
}))
const profiles: PlayerProfile[] = PEOPLE.map((p) => ({
  playerId: p.id,
  displayName: p.name,
  nickname: p.nickname,
  tagline: p.tagline,
  imageId: p.hasImage ? `img-${p.id}` : null,
}))
const images: PlayerImage[] = PEOPLE.filter((p) => p.hasImage).map((p) => ({
  id: `img-${p.id}`,
  playerId: p.id,
  contentType: 'image/svg+xml',
  sizeBytes: 1200,
  width: 256,
  height: 256,
  variants: { thumb: `headshots/${p.id}.svg`, medium: `headshots/${p.id}.svg` },
  createdAt: CREATED,
}))

const picks: Pick[] = []
for (const [playerId, story] of Object.entries(STORY)) {
  for (const [weekStr, entry] of Object.entries(story)) {
    if (!entry) continue
    const week = Number(weekStr)
    const [teamId] = entry
    const game = games.find(
      (g) => g.week === week && (g.homeTeamId === teamId || g.awayTeamId === teamId),
    )
    if (!game) throw new Error(`no game for ${teamId} week ${week}`)
    const [y, m, d] = dayOffset(sundayOf(week), -4) // Wednesday
    const submittedAt = easternToUtc(y, m, d, 12 + between(0, 9), between(0, 59))
    picks.push({
      id: `pick-${playerId}-${week}`,
      leagueId: LEAGUE_ID,
      seasonId: SEASON_ID,
      playerId,
      week,
      teamId,
      gameId: game.id,
      submittedAt,
      updatedAt: submittedAt,
      version: 1,
      source: week === 1 ? 'import' : 'player',
    })
  }
}

const snapshot: SeasonSnapshot = SeasonSnapshotSchema.parse({
  league: {
    id: LEAGUE_ID,
    name: 'The Sunday Survivors',
    tagline: 'One pick. Three lives. No mercy.',
    // Name and tagline are placeholders — rename in Commissioner → Settings.
    createdAt: CREATED,
    settings: {
      defaultLives: 3,
      tieCountsAsMiss: true,
      missingPickCountsAsMiss: true,
      cancelledGamePolicy: 'void',
      simultaneousEliminationPolicy: 'co-champions',
      hidePicksUntilLocked: true,
      displayTimeZone: 'America/New_York',
    },
    currentSeasonId: SEASON_ID,
  },
  season: {
    id: SEASON_ID,
    leagueId: LEAGUE_ID,
    year: SEASON_YEAR,
    label: '2026 Season',
    startWeek: 1,
    endWeek: 18,
    status: 'active',
    isSynthetic: true,
    notes:
      'Real roster and real week 1 picks. The schedule (matchups, kickoff times, byes) is synthetic ' +
      'and is NOT the real NFL fixture list. No results are recorded: enter them in Commissioner → ' +
      'Results, or connect a provider, and the standings compute themselves.',
  },
  memberships,
  profiles,
  images,
  picks,
  games,
  weeks,
  gameOverrides: [],
  decision: null,
})

const out = resolve(process.cwd(), 'src/data/demo/fixtures')
mkdirSync(out, { recursive: true })
writeFileSync(resolve(out, 'demo-season.json'), JSON.stringify(snapshot, null, 2) + '\n')
console.log(
  `wrote demo-season.json: ${games.length} games, ${picks.length} picks, ${profiles.length} players`,
)
