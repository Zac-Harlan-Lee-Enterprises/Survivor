import type {
  AuditEvent,
  CommissionerOverride,
  ImageContentType,
  League,
  LeagueGameOverride,
  LeagueMembership,
  LeagueSettings,
  NFLGame,
  NFLTeam,
  NFLWeek,
  Pick,
  PlayerImage,
  PlayerProfile,
  Season,
  SeasonDecision,
  SeasonSnapshot,
} from '@/domain'
import type { PickViolation } from '@/domain'

/**
 * Backend-agnostic ports. The UI depends only on these interfaces; the demo
 * implementation (fixtures + localStorage) and the connected implementation
 * (HTTPS calls to the AWS API) are swapped at build time via VITE_DATA_MODE.
 *
 * Architecture test: tests/architecture/layers.test.ts enforces that nothing
 * outside src/data/api/http.ts calls fetch(), and that src/domain never
 * imports React or the data layer.
 */

export type DataMode = 'demo' | 'connected'

export interface Actor {
  playerId: string
  displayName: string
  isCommissioner: boolean
}

/** A rule violation as reported by any backend (domain codes or server codes). */
export interface RuleViolation {
  code: PickViolation['code'] | string
  message: string
}

export interface ServiceError {
  code: string
  message: string
  violations?: RuleViolation[]
}

export class DataError extends Error implements ServiceError {
  code: string
  violations?: RuleViolation[]
  status?: number
  constructor(
    code: string,
    message: string,
    extra: { violations?: RuleViolation[]; status?: number } = {},
  ) {
    super(message)
    this.name = 'DataError'
    this.code = code
    this.violations = extra.violations
    this.status = extra.status
  }
}

// ---------------------------------------------------------------------------

export interface LeagueRepository {
  listLeagues(): Promise<League[]>
  getLeague(leagueId: string): Promise<League>
  getSeason(seasonId: string): Promise<Season>
  /** Everything needed to evaluate the season, already redacted for the viewer. */
  getSeasonSnapshot(seasonId: string): Promise<SeasonSnapshot>
  updateSettings(leagueId: string, settings: LeagueSettings, reason: string): Promise<League>
  updateSeason(
    seasonId: string,
    patch: Partial<Pick2<Season, 'label' | 'status' | 'startWeek' | 'endWeek' | 'notes'>>,
  ): Promise<Season>
  overrideGameResult(
    input: Omit<LeagueGameOverride, 'actorPlayerId' | 'createdAt'>,
  ): Promise<LeagueGameOverride>
  clearGameOverride(leagueId: string, gameId: string, reason: string): Promise<void>
  recordDecision(
    input: Omit<SeasonDecision, 'actorPlayerId' | 'decidedAt'>,
  ): Promise<SeasonDecision>
  listOverrides(seasonId: string): Promise<CommissionerOverride[]>
  listAuditEvents(leagueId: string, limit?: number): Promise<AuditEvent[]>
}

/** Local alias so the Pick domain type and TS's Pick utility don't collide. */
type Pick2<T, K extends keyof T> = { [P in K]: T[P] }

export interface PlayerRepository {
  listMemberships(seasonId: string): Promise<LeagueMembership[]>
  getProfile(playerId: string): Promise<PlayerProfile>
  upsertProfile(profile: PlayerProfile): Promise<PlayerProfile>
  addMember(input: {
    seasonId: string
    displayName: string
    nickname?: string
    email?: string
    role?: LeagueMembership['role']
  }): Promise<{ membership: LeagueMembership; profile: PlayerProfile }>
  updateMembership(
    membershipId: string,
    patch: Partial<Pick2<LeagueMembership, 'status' | 'role' | 'livesOverride'>>,
    reason: string,
  ): Promise<LeagueMembership>
}

export interface SubmitPickInput {
  seasonId: string
  playerId: string
  week: number
  teamId: string
  expectedVersion?: number
}

export type SubmitPickResult = { ok: true; pick: Pick } | { ok: false; violations: RuleViolation[] }

export interface PickRepository {
  listPicks(seasonId: string): Promise<Pick[]>
  /**
   * Every pick, unredacted. Commissioner-only, and deliberately NOT part of the
   * season snapshot: a commissioner who is also competing must not see rivals'
   * picks just by browsing the league. Reading them is an explicit act.
   */
  listAllPicks(seasonId: string): Promise<Pick[]>
  /** Authoritative in connected mode: the API re-validates every rule. */
  submitPick(input: SubmitPickInput): Promise<SubmitPickResult>
  /** Commissioner entry/correction; bypasses the kickoff lock, audited. */
  commissionerSetPick(input: SubmitPickInput & { reason: string }): Promise<Pick>
  commissionerClearPick(
    seasonId: string,
    playerId: string,
    week: number,
    reason: string,
  ): Promise<void>
  importPicks(seasonId: string, picks: Pick[], reason: string): Promise<{ imported: number }>
}

/** What one live-score sync did. */
export interface SyncSummary {
  /** Games whose score or status moved. */
  changed: number
  /** Games the provider reported that were already up to date. */
  skipped: number
  /** Games added because this week had no provider schedule yet. */
  created: number
  /** Picks re-pointed at the real game after replacing a placeholder schedule. */
  relinkedPicks: number
  /**
   * Picks whose team does not appear in the provider's slate for that week —
   * surfaced, never silently dropped.
   */
  orphanedPicks: string[]
  /** Where the data came from, for display. */
  provider: string
  observedAt: string
  /**
   * Game id → where it is up to right now ("3rd 5:21"), from THIS observation.
   *
   * Ephemeral by design and never stored: a clock that moves every few seconds
   * would either bump resultVersion on every tick or be served stale between
   * syncs. Absent when the provider does not report it.
   */
  liveDetail?: Record<string, string>
}

export interface GameResultInput {
  gameId: string
  status: NFLGame['status']
  homeScore?: number
  awayScore?: number
  winnerTeamId?: string | null
  kickoffAt?: string
}

export interface NFLDataProvider {
  readonly name: string
  getTeams(): Promise<NFLTeam[]>
  getWeeks(seasonYear: number): Promise<NFLWeek[]>
  getSchedule(seasonYear: number, week: number): Promise<NFLGame[]>
  getGame(gameId: string): Promise<NFLGame | null>
  getFinalResults(seasonYear: number, week: number): Promise<NFLGame[]>
  /** Commissioner manual-result fallback (also used when the provider is down). */
  recordManualResult?(input: GameResultInput, reason: string): Promise<NFLGame>
  /** Pull the live schedule and scores for one week from the provider. */
  syncResults?(seasonYear: number, week: number): Promise<SyncSummary>
  /** Commissioner enters/replaces one week's schedule by hand (provider outage or manual mode). */
  putSchedule?(seasonYear: number, week: number, games: NFLGame[]): Promise<{ saved: number }>
}

export interface ImageUploadTicket {
  imageId: string
  /** Presigned POST target for each variant, browser → S3 directly. */
  uploads: Record<'thumb' | 'medium', { url: string; fields: Record<string, string> }>
}

export interface ImageRepository {
  /** Resolves a stored image record's variant key to a URL (or the default avatar). */
  variantUrl(image: PlayerImage | null | undefined, variant: 'thumb' | 'medium'): string
  defaultAvatarUrl(): string
  requestUpload(
    playerId: string,
    meta: { contentType: ImageContentType; sizeBytes: number },
  ): Promise<ImageUploadTicket>
  uploadVariant(target: { url: string; fields: Record<string, string> }, blob: Blob): Promise<void>
  finalizeUpload(
    playerId: string,
    imageId: string,
    meta: { contentType: ImageContentType; sizeBytes: number; width: number; height: number },
  ): Promise<PlayerImage>
  removeImage(playerId: string): Promise<void>
}

export interface Session {
  actor: Actor
  /** Player ids this session may act as (commissioner impersonation is audited server-side). */
  expiresAt?: string
}

export interface AuthService {
  readonly kind: 'demo' | 'oidc'
  getSession(): Session | null
  signIn(options?: { asPlayerId?: string }): Promise<void>
  signOut(): Promise<void>
  /** Completes an OIDC redirect if the URL carries a code; no-op in demo. */
  handleCallback(): Promise<boolean>
  subscribe(listener: (session: Session | null) => void): () => void
  /** Demo only: the list of identities a visitor can try on. */
  listDemoIdentities?(): Promise<Actor[]>
}

export interface Clock {
  now(): Date
  /** Demo only: pin or release the clock. */
  set?(value: Date | null): void
  isPinned?(): boolean
  /** Notifies when the clock is re-pinned so the UI re-evaluates immediately. */
  subscribe?(listener: () => void): () => void
}

export interface Services {
  mode: DataMode
  leagues: LeagueRepository
  players: PlayerRepository
  picks: PickRepository
  nfl: NFLDataProvider
  images: ImageRepository
  auth: AuthService
  clock: Clock
  /** Demo only: wipe localStorage and reload fixtures. */
  resetDemo?(): Promise<void>
}
