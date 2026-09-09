import { z } from 'zod'

/**
 * Domain models for the survivor league. Zod schemas are the single source of
 * truth: the browser validates fixtures and API responses with them, and the
 * AWS backend validates request bodies with the same definitions.
 *
 * Every timestamp is an ISO-8601 string in UTC ("...Z"). Rendering in the
 * viewer's timezone is a presentation concern (see src/lib/time.ts).
 */

export const IsoDateTimeSchema = z.iso.datetime({ offset: true })
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>

export const IdSchema = z.string().min(1).max(120)
export const TeamIdSchema = z.string().min(2).max(4)
export const WeekNumberSchema = z.number().int().min(1).max(22)

// ---------------------------------------------------------------------------
// League / Season
// ---------------------------------------------------------------------------

export const LeagueSettingsSchema = z.object({
  /** Lives every player starts with. Spec default: 3. */
  defaultLives: z.number().int().min(1).max(10).default(3),
  /** A tie is a miss (spec default) — configurable for other pools. */
  tieCountsAsMiss: z.boolean().default(true),
  /** No pick by the week deadline consumes a life. */
  missingPickCountsAsMiss: z.boolean().default(true),
  /**
   * Minutes before the week's FIRST kickoff at which every pick locks.
   * The whole league locks together at one deadline, so nobody can watch an
   * early result before committing. 0 would lock exactly at first kickoff.
   */
  pickLockMinutesBeforeFirstKickoff: z.number().int().min(0).max(10_080).default(5),
  /**
   * A cancelled game (never played) either voids the pick — no life lost and
   * the team returns to the pool — or counts as a miss.
   */
  cancelledGamePolicy: z.enum(['void', 'miss']).default('void'),
  /**
   * When every remaining player is eliminated in the same week (or several
   * survive the final week): declare co-champions, or leave tied finalists
   * for the commissioner to resolve with a recorded decision.
   */
  simultaneousEliminationPolicy: z
    .enum(['co-champions', 'commissioner-decides'])
    .default('co-champions'),
  /** Other players' picks stay hidden until the picked game kicks off. */
  hidePicksUntilLocked: z.boolean().default(true),
  /**
   * The league's canonical timezone. Kickoffs and deadlines are rendered in it
   * (with the zone abbreviation) so everyone quotes the same clock, wherever
   * they happen to be. Timestamps themselves are always stored in UTC.
   */
  displayTimeZone: z.string().default('America/Chicago'),
})
export type LeagueSettings = z.infer<typeof LeagueSettingsSchema>

export const LeagueSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(80),
  tagline: z.string().max(140).optional(),
  createdAt: IsoDateTimeSchema,
  settings: LeagueSettingsSchema,
  currentSeasonId: IdSchema,
})
export type League = z.infer<typeof LeagueSchema>

export const SeasonStatusSchema = z.enum(['upcoming', 'active', 'complete'])
export const SeasonSchema = z.object({
  id: IdSchema,
  leagueId: IdSchema,
  year: z.number().int().min(2000).max(2100),
  label: z.string().min(1).max(60),
  startWeek: WeekNumberSchema.default(1),
  endWeek: WeekNumberSchema.default(18),
  status: SeasonStatusSchema,
  /** True for the demo fixture: schedule and results are synthetic, not real NFL data. */
  isSynthetic: z.boolean().default(false),
  notes: z.string().max(500).optional(),
})
export type Season = z.infer<typeof SeasonSchema>

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export const PlayerSchema = z.object({
  id: IdSchema,
  email: z.email().optional(),
  displayName: z.string().min(1).max(60),
  createdAt: IsoDateTimeSchema,
})
export type Player = z.infer<typeof PlayerSchema>

export const PlayerProfileSchema = z.object({
  playerId: IdSchema,
  displayName: z.string().min(1).max(60),
  nickname: z.string().max(40).optional(),
  tagline: z.string().max(120).optional(),
  /** Asset identifier only — binaries live in S3 (connected) or public/ (demo). */
  imageId: IdSchema.nullable().default(null),
})
export type PlayerProfile = z.infer<typeof PlayerProfileSchema>

/** Types a commissioner may UPLOAD. SVG is deliberately excluded (scripts). */
export const ImageContentTypeSchema = z.enum(['image/jpeg', 'image/png', 'image/webp'])
export type ImageContentType = z.infer<typeof ImageContentTypeSchema>
/** Types a stored record may carry: uploads plus the seeded SVG placeholders. */
export const StoredImageContentTypeSchema = z.enum([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
])
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024

export const PlayerImageSchema = z.object({
  id: IdSchema,
  playerId: IdSchema,
  contentType: StoredImageContentTypeSchema,
  sizeBytes: z.number().int().min(1).max(IMAGE_MAX_BYTES),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  /** Variant → URL or storage key. Thumbs are ~128px, medium ~512px. */
  variants: z.object({
    thumb: z.string().min(1),
    medium: z.string().min(1),
  }),
  createdAt: IsoDateTimeSchema,
})
export type PlayerImage = z.infer<typeof PlayerImageSchema>

export const MembershipRoleSchema = z.enum(['commissioner', 'player'])
export type MembershipRole = z.infer<typeof MembershipRoleSchema>
export const MembershipStatusSchema = z.enum(['active', 'inactive'])

export const LeagueMembershipSchema = z.object({
  id: IdSchema,
  leagueId: IdSchema,
  seasonId: IdSchema,
  playerId: IdSchema,
  role: MembershipRoleSchema,
  status: MembershipStatusSchema,
  /** Commissioner-granted lives for this player; otherwise settings.defaultLives. */
  livesOverride: z.number().int().min(1).max(10).optional(),
  joinedAt: IsoDateTimeSchema,
})
export type LeagueMembership = z.infer<typeof LeagueMembershipSchema>

// ---------------------------------------------------------------------------
// NFL data
// ---------------------------------------------------------------------------

export const NFLTeamSchema = z.object({
  id: TeamIdSchema,
  abbreviation: TeamIdSchema,
  location: z.string(),
  name: z.string(),
  fullName: z.string(),
  conference: z.enum(['AFC', 'NFC']),
  division: z.enum(['East', 'North', 'South', 'West']),
  colors: z.object({ primary: z.string(), secondary: z.string() }),
  aliases: z.array(z.string()),
})
export type NFLTeam = z.infer<typeof NFLTeamSchema>

/** Where a week's schedule came from, so the UI never implies invented data is real. */
export const ScheduleSourceSchema = z.enum(['synthetic', 'provider', 'manual'])
export type ScheduleSource = z.infer<typeof ScheduleSourceSchema>

export const NFLWeekSchema = z.object({
  seasonYear: z.number().int(),
  week: WeekNumberSchema,
  label: z.string(),
  byeTeamIds: z.array(TeamIdSchema),
  source: ScheduleSourceSchema.default('synthetic'),
})
export type NFLWeek = z.infer<typeof NFLWeekSchema>

export const GameStatusSchema = z.enum([
  'scheduled',
  'in_progress',
  'final',
  'postponed',
  'cancelled',
])
export type GameStatus = z.infer<typeof GameStatusSchema>

export const ResultSourceSchema = z.enum(['provider', 'commissioner'])

export const NFLGameSchema = z.object({
  id: IdSchema,
  seasonYear: z.number().int(),
  week: WeekNumberSchema,
  homeTeamId: TeamIdSchema,
  awayTeamId: TeamIdSchema,
  kickoffAt: IsoDateTimeSchema,
  status: GameStatusSchema,
  homeScore: z.number().int().min(0).optional(),
  awayScore: z.number().int().min(0).optional(),
  /** Set when final: winning team id, or null for a tie. */
  winnerTeamId: TeamIdSchema.nullable().optional(),
  /** Monotonic; every accepted change bumps it. Enables idempotent processing. */
  resultVersion: z.number().int().min(0).default(0),
  resultSource: ResultSourceSchema.optional(),
  updatedAt: IsoDateTimeSchema,
})
export type NFLGame = z.infer<typeof NFLGameSchema>

/** A result observation from a provider or the commissioner. */
export const GameResultUpdateSchema = z.object({
  gameId: IdSchema,
  status: GameStatusSchema,
  homeScore: z.number().int().min(0).optional(),
  awayScore: z.number().int().min(0).optional(),
  winnerTeamId: TeamIdSchema.nullable().optional(),
  /** New kickoff for postponed/rescheduled games. */
  kickoffAt: IsoDateTimeSchema.optional(),
  source: ResultSourceSchema,
  observedAt: IsoDateTimeSchema,
})
export type GameResultUpdate = z.infer<typeof GameResultUpdateSchema>

// ---------------------------------------------------------------------------
// Picks and outcomes
// ---------------------------------------------------------------------------

export const PickSourceSchema = z.enum(['player', 'commissioner', 'import'])
export type PickSource = z.infer<typeof PickSourceSchema>

export const PickSchema = z.object({
  id: IdSchema,
  leagueId: IdSchema,
  seasonId: IdSchema,
  playerId: IdSchema,
  week: WeekNumberSchema,
  teamId: TeamIdSchema,
  gameId: IdSchema,
  submittedAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  /** Optimistic-concurrency version; changes must present the version they saw. */
  version: z.number().int().min(1).default(1),
  source: PickSourceSchema,
})
export type Pick = z.infer<typeof PickSchema>

export const PickOutcomeSchema = z.enum([
  'win',
  'loss',
  'tie',
  'pending',
  'void',
  'missing',
  'not_required',
])
export type PickOutcome = z.infer<typeof PickOutcomeSchema>

// ---------------------------------------------------------------------------
// Commissioner overrides and audit
// ---------------------------------------------------------------------------

export const LeagueGameOverrideSchema = z.object({
  leagueId: IdSchema,
  gameId: IdSchema,
  status: GameStatusSchema,
  homeScore: z.number().int().min(0).optional(),
  awayScore: z.number().int().min(0).optional(),
  winnerTeamId: TeamIdSchema.nullable().optional(),
  reason: z.string().min(1).max(300),
  actorPlayerId: IdSchema,
  createdAt: IsoDateTimeSchema,
})
export type LeagueGameOverride = z.infer<typeof LeagueGameOverrideSchema>

export const SeasonDecisionSchema = z.object({
  seasonId: IdSchema,
  championPlayerIds: z.array(IdSchema).min(1),
  reason: z.string().min(1).max(300),
  actorPlayerId: IdSchema,
  decidedAt: IsoDateTimeSchema,
})
export type SeasonDecision = z.infer<typeof SeasonDecisionSchema>

export const CommissionerOverrideTypeSchema = z.enum([
  'pick',
  'game_result',
  'lives',
  'champion',
  'membership',
  'settings',
  'import',
])
export const CommissionerOverrideSchema = z.object({
  id: IdSchema,
  leagueId: IdSchema,
  seasonId: IdSchema,
  type: CommissionerOverrideTypeSchema,
  targetId: z.string(),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  reason: z.string().max(300),
  actorPlayerId: IdSchema,
  createdAt: IsoDateTimeSchema,
})
export type CommissionerOverride = z.infer<typeof CommissionerOverrideSchema>

export const AuditEventSchema = z.object({
  id: IdSchema,
  leagueId: IdSchema,
  at: IsoDateTimeSchema,
  actorPlayerId: IdSchema.nullable(),
  type: z.string().min(1).max(60),
  summary: z.string().min(1).max(300),
  details: z.record(z.string(), z.unknown()).optional(),
})
export type AuditEvent = z.infer<typeof AuditEventSchema>

// ---------------------------------------------------------------------------
// Aggregates exchanged between data layer and rules engine
// ---------------------------------------------------------------------------

/** Everything the rules engine needs to evaluate one season, fully loaded. */
export const SeasonSnapshotSchema = z.object({
  league: LeagueSchema,
  season: SeasonSchema,
  memberships: z.array(LeagueMembershipSchema),
  profiles: z.array(PlayerProfileSchema),
  images: z.array(PlayerImageSchema).default([]),
  picks: z.array(PickSchema),
  games: z.array(NFLGameSchema),
  weeks: z.array(NFLWeekSchema),
  gameOverrides: z.array(LeagueGameOverrideSchema).default([]),
  decision: SeasonDecisionSchema.nullable().default(null),
  /** Picks that exist but are redacted for this viewer (other players, not yet kicked off). */
  hiddenPicks: z.array(z.object({ playerId: IdSchema, week: WeekNumberSchema })).default([]),
})
export type SeasonSnapshot = z.infer<typeof SeasonSnapshotSchema>
