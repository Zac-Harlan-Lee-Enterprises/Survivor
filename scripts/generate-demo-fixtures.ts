/**
 * Generates src/data/demo/fixtures/demo-season.json — the seed for demo mode.
 *
 * EVERYTHING here is synthetic: sample players, a made-up schedule and
 * made-up results. It is deterministic (seeded PRNG) so the demo, the tests
 * and the screenshots always agree. It is NOT the real NFL schedule; real
 * data comes from a provider in connected mode.
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
// The cast (fictional) and the story the demo tells
// ---------------------------------------------------------------------------
const SEASON_YEAR = 2026
const LEAGUE_ID = 'demo-league'
const SEASON_ID = 'demo-2026'
const CREATED = '2026-08-15T14:00:00.000Z'

interface Person {
  id: string
  name: string
  nickname: string
  tagline: string
  role: LeagueMembership['role']
  hasImage: boolean
}
const PEOPLE: Person[] = [
  {
    id: 'marcus-bell',
    name: 'Marcus Bell',
    nickname: 'The Closer',
    tagline: 'Never picks a road dog.',
    role: 'player',
    hasImage: true,
  },
  {
    id: 'priya-raman',
    name: 'Priya Raman',
    nickname: 'Ice',
    tagline: 'Two-time champ. Allegedly.',
    role: 'player',
    hasImage: true,
  },
  {
    id: 'danny-okafor',
    name: 'Danny Okafor',
    nickname: 'Commish',
    tagline: 'Runs the league. Loses in it.',
    role: 'commissioner',
    hasImage: true,
  },
  {
    id: 'sofia-reyes',
    name: 'Sofia Reyes',
    nickname: 'Sunday Sofia',
    tagline: 'Picks with her heart.',
    role: 'player',
    hasImage: true,
  },
  {
    id: 'tom-lindqvist',
    name: 'Tom Lindqvist',
    nickname: 'Big Tom',
    tagline: 'Went 0-3. Still smiling.',
    role: 'player',
    hasImage: true,
  },
  {
    id: 'jada-whitfield',
    name: 'Jada Whitfield',
    nickname: 'J-Dub',
    tagline: 'Spreadsheet in one hand, wings in the other.',
    role: 'player',
    hasImage: true,
  },
  {
    id: 'luis-herrera',
    name: 'Luis Herrera',
    nickname: 'Lucky Luis',
    tagline: 'Survived a tie. Barely.',
    role: 'player',
    hasImage: true,
  },
  {
    id: 'emily-chen',
    name: 'Emily Chen',
    nickname: 'The Analyst',
    tagline: 'Has a model. Won’t share it.',
    role: 'player',
    hasImage: true,
  },
  {
    id: 'kwame-mensah',
    name: 'Kwame Mensah',
    nickname: 'K-Money',
    tagline: 'Lives on the bubble.',
    role: 'player',
    hasImage: false,
  },
  {
    id: 'hannah-obrien',
    name: "Hannah O'Brien",
    nickname: 'Hurricane Hannah',
    tagline: 'Forgot to pick once. Never again.',
    role: 'player',
    hasImage: true,
  },
]

/** [team, outcome]. W = win, L = loss, T = tie, P = pending (week open). null = no pick. */
type Outcome = 'W' | 'L' | 'T' | 'P'
type Story = Record<string, Record<number, [string, Outcome] | null>>
const STORY: Story = {
  'marcus-bell': { 1: ['KC', 'W'], 2: ['PHI', 'W'], 3: ['BAL', 'W'], 4: ['DET', 'P'] },
  'priya-raman': { 1: ['BUF', 'W'], 2: ['SF', 'L'], 3: ['DET', 'W'], 4: ['KC', 'W'] },
  'danny-okafor': { 1: ['DAL', 'L'], 2: ['BUF', 'W'], 3: ['SF', 'W'], 4: ['GB', 'P'] },
  'sofia-reyes': { 1: ['GB', 'L'], 2: ['KC', 'W'], 3: ['DAL', 'L'], 4: null },
  'tom-lindqvist': { 1: ['NYJ', 'L'], 2: ['CAR', 'L'], 3: ['ARI', 'L'], 4: null },
  'jada-whitfield': { 1: ['PHI', 'W'], 2: ['BAL', 'W'], 3: ['KC', 'W'], 4: ['SF', 'P'] },
  'luis-herrera': { 1: ['SF', 'W'], 2: ['DEN', 'T'], 3: ['PHI', 'W'], 4: ['MIN', 'P'] },
  'emily-chen': { 1: ['BAL', 'W'], 2: ['KC', 'W'], 3: ['GB', 'W'], 4: ['PHI', 'P'] },
  'kwame-mensah': { 1: ['CIN', 'L'], 2: ['MIA', 'L'], 3: ['HOU', 'W'], 4: null },
  'hannah-obrien': { 1: ['DET', 'W'], 2: null, 3: ['LAC', 'W'], 4: null },
}
const RESOLVED_WEEKS = new Set([1, 2, 3])
const CURRENT_WEEK = 4

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

  // Slots: keep the week-4 KC game on Thursday so one pick is already locked
  // and final when the demo opens (Sunday morning of week 4).
  let ordered = shuffle(pairs)
  if (week === CURRENT_WEEK) {
    const kc = ordered.find((p) => p.includes('KC'))!
    ordered = [kc, ...ordered.filter((p) => p !== kc)]
  }
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
    const decideFinal = RESOLVED_WEEKS.has(week) || (week === CURRENT_WEEK && slot === 'TNF')
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
    label: '2026 Demo Season',
    startWeek: 1,
    endWeek: 18,
    status: 'active',
    isSynthetic: true,
    notes:
      'Synthetic schedule, results and sample players for demonstration only. Not real NFL data.',
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
