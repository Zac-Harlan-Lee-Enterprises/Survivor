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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
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
// Deterministic randomness (pick timestamps only — nothing about the schedule
// or anyone's results is generated)
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
const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1))

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
}
const PEOPLE: Person[] = [
  { id: 'maya-israel', name: 'Maya Israel', role: 'player' },
  { id: 'shahid-ali', name: 'Shahid Ali', role: 'player' },
  { id: 'dave-johnson', name: 'Dave Johnson', role: 'player' },
  { id: 'james-parker', name: 'James Parker', role: 'player' },
  { id: 'nate-adams', name: 'Nate Adams', role: 'player' },
  { id: 'stacey-markendorff', name: 'Stacey Markendorff', role: 'player' },
  { id: 'sheila-acker', name: 'Sheila Acker', role: 'player' },
  { id: 'dominic-green', name: 'Dominic Green', role: 'player' },
  { id: 'tracy-nelson', name: 'Tracy Nelson', role: 'player' },
  { id: 'bradley-riedell', name: 'Bradley Riedell', role: 'player' },
  { id: 'chloe-bourque', name: 'Chloe Bourque', role: 'player' },
  { id: 'jared-marks', name: 'Jared Marks', role: 'player' },
  { id: 'joseph-tomczuk', name: 'Joseph Tomczuk', role: 'player' },
  { id: 'corey-cowell', name: 'Corey Cowell', role: 'player' },
  { id: 'melanie-moeller', name: 'Melanie Moeller', role: 'player' },
  { id: 'jason-snook', name: 'Jason Snook', role: 'player' },
  { id: 'matt-hadley', name: 'Matt Hadley', role: 'player' },
  { id: 'mike-lancaster', name: 'Mike Lancaster', role: 'player' },
  { id: 'kc-walker', name: 'KC Walker', role: 'player' },
  { id: 'paul-lim', name: 'Paul Lim', role: 'player' },
  { id: 'tony-canody', name: 'Tony Canody', role: 'player' },
  { id: 'joanna-moss', name: 'Joanna Moss', role: 'player' },
  { id: 'allison-petty', name: 'Allison Petty', role: 'player' },
  { id: 'don-turner', name: 'Don Turner', role: 'player' },
  { id: 'cindy-mendoza', name: 'Cindy Mendoza', role: 'player' },
  { id: 'phyllis-collins', name: 'Phyllis Collins', role: 'player' },
  { id: 'wesley-childers', name: 'Wesley Childers', role: 'player' },
  // Commissioner: runs the league and holds the admin tools.
  { id: 'zac-harlan', name: 'Zac Harlan', role: 'commissioner' },
]

/** [team, outcome]. Outcomes are informational only: real results come from the provider. */
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
  // Same team as Sheila Acker — different players may ride the same team.
  'tracy-nelson': { 1: ['SEA', 'P'] },
  // Third player on the Lions, alongside Dave Johnson and James Parker.
  'bradley-riedell': { 1: ['DET', 'P'] },
  'chloe-bourque': { 1: ['JAX', 'P'] },
  'jared-marks': { 1: ['LAC', 'P'] },
  'joseph-tomczuk': { 1: ['JAX', 'P'] },
  'corey-cowell': { 1: ['PIT', 'P'] },
  'melanie-moeller': { 1: ['LAC', 'P'] },
  'jason-snook': { 1: ['JAX', 'P'] },
  'matt-hadley': { 1: ['GB', 'P'] },
  'mike-lancaster': { 1: ['SEA', 'P'] },
  'kc-walker': { 1: ['JAX', 'P'] },
  'paul-lim': { 1: ['JAX', 'P'] },
  'tony-canody': { 1: ['LAC', 'P'] },
  // First player on the Cowboys.
  'joanna-moss': { 1: ['DAL', 'P'] },
  'allison-petty': { 1: ['DET', 'P'] },
  'don-turner': { 1: ['PIT', 'P'] },
  'cindy-mendoza': { 1: ['JAX', 'P'] },
  'phyllis-collins': { 1: ['SEA', 'P'] },
  'wesley-childers': { 1: ['DET', 'P'] },
  'zac-harlan': { 1: ['LAC', 'P'] },
}

// ---------------------------------------------------------------------------
// Schedule — the REAL fixture list, cached by `npm run schedule:fetch`
//
// Reading a committed cache (rather than calling ESPN here) keeps fixture
// generation deterministic and offline-capable. If the cache is missing the
// build fails loudly instead of quietly inventing matchups: a made-up schedule
// shown as real is exactly the failure this project must not have.
// ---------------------------------------------------------------------------
interface CachedSchedule {
  seasonYear: number
  source: string
  fetchedAt: string
  weeks: Array<{ week: NFLWeek; games: NFLGame[] }>
}

const schedulePath = resolve(process.cwd(), 'scripts/data', `nfl-${SEASON_YEAR}-schedule.json`)
if (!existsSync(schedulePath)) {
  console.error(`Missing ${schedulePath}. Run: npm run schedule:fetch`)
  process.exit(1)
}
const cached = JSON.parse(readFileSync(schedulePath, 'utf8')) as CachedSchedule

const games: NFLGame[] = []
const weeks: NFLWeek[] = []
for (const entry of cached.weeks) {
  weeks.push(entry.week)
  games.push(...entry.games)
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
/**
 * Real headshots, imported from the commissioner's photo folder by
 * `npm run headshots:import` (which writes public/headshots/manifest.json).
 * A player with no photo simply has no image record and falls back to the
 * default avatar — nothing stands in for a real person's face.
 */
interface ManifestEntry {
  contentType: PlayerImage['contentType']
  sizeBytes: number
  width: number
  height: number
  variants: { thumb: string; medium: string }
}
const manifestPath = resolve(process.cwd(), 'public/headshots/manifest.json')
const manifest: Record<string, ManifestEntry> = existsSync(manifestPath)
  ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, ManifestEntry>)
  : {}

const images: PlayerImage[] = PEOPLE.flatMap((p) => {
  const entry = manifest[p.id]
  if (!entry) return []
  return [
    {
      id: `img-${p.id}`,
      playerId: p.id,
      contentType: entry.contentType,
      sizeBytes: entry.sizeBytes,
      width: entry.width,
      height: entry.height,
      variants: entry.variants,
      createdAt: CREATED,
    },
  ]
})
const withPhoto = new Set(images.map((i) => i.playerId))

const profiles: PlayerProfile[] = PEOPLE.map((p) => ({
  playerId: p.id,
  displayName: p.name,
  nickname: p.nickname,
  tagline: p.tagline,
  imageId: withPhoto.has(p.id) ? `img-${p.id}` : null,
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
    if (!game) {
      throw new Error(
        `${playerId} picked ${teamId} in week ${week}, but that team has no game in the real schedule. ` +
          'Check the pick, or refresh the cache with: npm run schedule:fetch',
      )
    }
    // Submitted at a deterministic moment before that game's real kickoff, so
    // the seeded history is plausible without inventing a calendar.
    const submittedAt = new Date(
      new Date(game.kickoffAt).getTime() - (24 + between(6, 72)) * 3_600_000,
    ).toISOString()
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
      displayTimeZone: 'America/Chicago',
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
    isSynthetic: false,
    notes:
      `Real roster, real week 1 picks, and the real NFL schedule (${cached.source}, cached ${cached.fetchedAt}). ` +
      'Live scores refresh from the same provider in Commissioner → Results; the commissioner can ' +
      'always enter or correct a result by hand.',
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
