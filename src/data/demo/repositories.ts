import {
  applyGameResult,
  applyGameResults,
  evaluateSeason,
  redactPicks,
  redactSnapshot,
  validatePick,
  NFL_TEAMS,
  type AuditEvent,
  type CommissionerOverride,
  type League,
  type LeagueGameOverride,
  type LeagueMembership,
  type LeagueSettings,
  type NFLGame,
  type NFLTeam,
  type NFLWeek,
  type Pick,
  type PlayerImage,
  type PlayerProfile,
  type Season,
  type SeasonDecision,
  type SeasonSnapshot,
  type GameResultUpdate,
} from '@/domain'
import {
  DataError,
  type Clock,
  type GameResultInput,
  type ImageRepository,
  type ImageUploadTicket,
  type LeagueRepository,
  type NFLDataProvider,
  type PickRepository,
  type PlayerRepository,
  type SubmitPickInput,
  type SubmitPickResult,
} from '../interfaces'
import { createEspnClient, type EspnClient } from '../nfl/espnClient'
import type { DemoStore } from './store'

/**
 * Demo repositories. They enforce the same domain rules the AWS backend does
 * (validatePick, applyGameResult) so demo behaviour matches production, but
 * they persist to localStorage only — a single browser, not a league.
 */

interface Ctx {
  store: DemoStore
  clock: Clock
  viewer: () => { playerId: string | null; isCommissioner: boolean }
  assetBase: string
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function requireCommissioner(ctx: Ctx): string {
  const v = ctx.viewer()
  if (!v.isCommissioner || !v.playerId) {
    throw new DataError('FORBIDDEN', 'Only the commissioner can do that.', { status: 403 })
  }
  return v.playerId
}

function delay<T>(value: T): Promise<T> {
  // A whisper of latency keeps loading states honest in the demo.
  return new Promise((resolve) => setTimeout(() => resolve(value), 40))
}

export function createDemoLeagueRepository(ctx: Ctx): LeagueRepository {
  const { store } = ctx
  return {
    async listLeagues() {
      return delay([store.snapshot().league])
    },
    async getLeague(leagueId) {
      const league = store.snapshot().league
      if (league.id !== leagueId)
        throw new DataError('NOT_FOUND', `League ${leagueId} not found`, { status: 404 })
      return delay(league)
    },
    async getSeason(seasonId) {
      const season = store.snapshot().season
      if (season.id !== seasonId)
        throw new DataError('NOT_FOUND', `Season ${seasonId} not found`, { status: 404 })
      return delay(season)
    },
    async getSeasonSnapshot(seasonId) {
      const snap = store.snapshot()
      if (snap.season.id !== seasonId)
        throw new DataError('NOT_FOUND', `Season ${seasonId} not found`, { status: 404 })
      const redacted: SeasonSnapshot = redactSnapshot(snap, ctx.viewer(), ctx.clock.now())
      return delay(redacted)
    },
    async updateSettings(leagueId, settings: LeagueSettings, reason) {
      const actor = requireCommissioner(ctx)
      const before = store.snapshot().league.settings
      store.update((d) => {
        d.snapshot.league.settings = settings
      })
      const at = ctx.clock.now().toISOString()
      store.override({
        type: 'settings',
        targetId: leagueId,
        before,
        after: settings,
        reason,
        actorPlayerId: actor,
        createdAt: at,
      })
      store.audit({
        at,
        actorPlayerId: actor,
        type: 'settings.updated',
        summary: `League settings updated: ${reason}`,
      })
      return store.snapshot().league as League
    },
    async updateSeason(seasonId, patch) {
      const actor = requireCommissioner(ctx)
      store.update((d) => {
        Object.assign(d.snapshot.season, patch)
      })
      store.audit({
        at: ctx.clock.now().toISOString(),
        actorPlayerId: actor,
        type: 'season.updated',
        summary: `Season ${seasonId} updated (${Object.keys(patch).join(', ')})`,
      })
      return store.snapshot().season as Season
    },
    async overrideGameResult(input) {
      const actor = requireCommissioner(ctx)
      const at = ctx.clock.now().toISOString()
      const game = store.snapshot().games.find((g) => g.id === input.gameId)
      if (!game) throw new DataError('NOT_FOUND', 'Game not found', { status: 404 })
      // Reuse the result engine so the override is validated (winner vs score).
      const outcome = applyGameResult(game, { ...input, source: 'commissioner', observedAt: at })
      const override: LeagueGameOverride = {
        leagueId: input.leagueId,
        gameId: input.gameId,
        status: outcome.game.status,
        homeScore: outcome.game.homeScore,
        awayScore: outcome.game.awayScore,
        winnerTeamId: outcome.game.winnerTeamId,
        reason: input.reason,
        actorPlayerId: actor,
        createdAt: at,
      }
      const before = store.snapshot().gameOverrides.find((o) => o.gameId === input.gameId) ?? game
      store.update((d) => {
        d.snapshot.gameOverrides = [
          ...d.snapshot.gameOverrides.filter((o) => o.gameId !== input.gameId),
          override,
        ]
      })
      store.override({
        type: 'game_result',
        targetId: input.gameId,
        before,
        after: override,
        reason: input.reason,
        actorPlayerId: actor,
        createdAt: at,
      })
      store.audit({
        at,
        actorPlayerId: actor,
        type: 'game.overridden',
        summary: `Result of ${game.awayTeamId} @ ${game.homeTeamId} (week ${game.week}) overridden: ${input.reason}`,
      })
      return override
    },
    async clearGameOverride(_leagueId, gameId, reason) {
      const actor = requireCommissioner(ctx)
      const at = ctx.clock.now().toISOString()
      const before = store.snapshot().gameOverrides.find((o) => o.gameId === gameId)
      store.update((d) => {
        d.snapshot.gameOverrides = d.snapshot.gameOverrides.filter((o) => o.gameId !== gameId)
      })
      store.override({
        type: 'game_result',
        targetId: gameId,
        before,
        after: null,
        reason,
        actorPlayerId: actor,
        createdAt: at,
      })
      store.audit({
        at,
        actorPlayerId: actor,
        type: 'game.override_cleared',
        summary: `Override on ${gameId} cleared: ${reason}`,
      })
    },
    async recordDecision(input) {
      const actor = requireCommissioner(ctx)
      const at = ctx.clock.now().toISOString()
      const decision: SeasonDecision = { ...input, actorPlayerId: actor, decidedAt: at }
      const before = store.snapshot().decision
      store.update((d) => {
        d.snapshot.decision = decision
      })
      store.override({
        type: 'champion',
        targetId: input.seasonId,
        before,
        after: decision,
        reason: input.reason,
        actorPlayerId: actor,
        createdAt: at,
      })
      store.audit({
        at,
        actorPlayerId: actor,
        type: 'season.decided',
        summary: `Champion(s) recorded: ${input.championPlayerIds.join(', ')} — ${input.reason}`,
      })
      return decision
    },
    async listOverrides() {
      return delay(store.get().overrides as CommissionerOverride[])
    },
    async listAuditEvents(_leagueId, limit = 100) {
      return delay(store.get().audit.slice(0, limit) as AuditEvent[])
    },
  }
}

export function createDemoPlayerRepository(ctx: Ctx): PlayerRepository {
  const { store } = ctx
  return {
    async listMemberships(seasonId) {
      return delay(store.snapshot().memberships.filter((m) => m.seasonId === seasonId))
    },
    async getProfile(playerId) {
      const p = store.snapshot().profiles.find((x) => x.playerId === playerId)
      if (!p) throw new DataError('NOT_FOUND', 'Player not found', { status: 404 })
      return delay(p)
    },
    async upsertProfile(profile: PlayerProfile) {
      const v = ctx.viewer()
      if (!v.isCommissioner && v.playerId !== profile.playerId) {
        throw new DataError('FORBIDDEN', 'You can only edit your own profile.', { status: 403 })
      }
      store.update((d) => {
        const i = d.snapshot.profiles.findIndex((p) => p.playerId === profile.playerId)
        if (i >= 0) d.snapshot.profiles[i] = profile
        else d.snapshot.profiles.push(profile)
      })
      store.audit({
        at: ctx.clock.now().toISOString(),
        actorPlayerId: v.playerId,
        type: 'profile.updated',
        summary: `${profile.displayName}'s profile updated`,
      })
      return profile
    },
    async addMember(input) {
      const actor = requireCommissioner(ctx)
      const at = ctx.clock.now().toISOString()
      const snap = store.snapshot()
      let playerId = slugify(input.displayName) || `player-${snap.memberships.length + 1}`
      if (snap.profiles.some((p) => p.playerId === playerId))
        playerId = `${playerId}-${snap.memberships.length + 1}`
      const membership: LeagueMembership = {
        id: `m-${playerId}`,
        leagueId: snap.league.id,
        seasonId: input.seasonId,
        playerId,
        role: input.role ?? 'player',
        status: 'active',
        joinedAt: at,
      }
      const profile: PlayerProfile = {
        playerId,
        displayName: input.displayName,
        nickname: input.nickname,
        imageId: null,
      }
      store.update((d) => {
        d.snapshot.memberships.push(membership)
        d.snapshot.profiles.push(profile)
      })
      store.override({
        type: 'membership',
        targetId: membership.id,
        before: null,
        after: membership,
        reason: 'added by commissioner',
        actorPlayerId: actor,
        createdAt: at,
      })
      store.audit({
        at,
        actorPlayerId: actor,
        type: 'member.added',
        summary: `${input.displayName} joined the league`,
      })
      return { membership, profile }
    },
    async updateMembership(membershipId, patch, reason) {
      const actor = requireCommissioner(ctx)
      const at = ctx.clock.now().toISOString()
      const before = store.snapshot().memberships.find((m) => m.id === membershipId)
      if (!before) throw new DataError('NOT_FOUND', 'Membership not found', { status: 404 })
      const after = { ...before, ...patch }
      store.update((d) => {
        const i = d.snapshot.memberships.findIndex((m) => m.id === membershipId)
        if (i >= 0) d.snapshot.memberships[i] = after
      })
      store.override({
        type: patch.livesOverride !== undefined ? 'lives' : 'membership',
        targetId: membershipId,
        before,
        after,
        reason,
        actorPlayerId: actor,
        createdAt: at,
      })
      const name =
        store.snapshot().profiles.find((p) => p.playerId === before.playerId)?.displayName ??
        before.playerId
      store.audit({
        at,
        actorPlayerId: actor,
        type: 'member.updated',
        summary: `${name}: ${Object.entries(patch)
          .map(([k, v]) => `${k}=${String(v)}`)
          .join(', ')} — ${reason}`,
      })
      return after
    },
  }
}

export function createDemoPickRepository(ctx: Ctx): PickRepository {
  const { store } = ctx

  const upsert = (
    input: SubmitPickInput,
    game: NFLGame,
    source: Pick['source'],
    at: string,
  ): Pick => {
    let saved: Pick | null = null
    store.update((d) => {
      const i = d.snapshot.picks.findIndex(
        (p) =>
          p.seasonId === input.seasonId && p.playerId === input.playerId && p.week === input.week,
      )
      if (i >= 0) {
        const prev = d.snapshot.picks[i]!
        saved = {
          ...prev,
          teamId:
            game.homeTeamId === input.teamId.toUpperCase() ? game.homeTeamId : game.awayTeamId,
          gameId: game.id,
          updatedAt: at,
          version: prev.version + 1,
          source,
        }
        d.snapshot.picks[i] = saved
      } else {
        saved = {
          id: `pick-${input.playerId}-${input.week}`,
          leagueId: d.snapshot.league.id,
          seasonId: input.seasonId,
          playerId: input.playerId,
          week: input.week,
          teamId: input.teamId.toUpperCase(),
          gameId: game.id,
          submittedAt: at,
          updatedAt: at,
          version: 1,
          source,
        }
        d.snapshot.picks.push(saved)
      }
    })
    return saved!
  }

  return {
    async listPicks(seasonId) {
      const snap = store.snapshot()
      if (snap.season.id !== seasonId) return []
      return delay(redactPicks(snap, ctx.viewer(), ctx.clock.now()))
    },
    async listAllPicks(seasonId) {
      requireCommissioner(ctx)
      const snap = store.snapshot()
      if (snap.season.id !== seasonId) return []
      return delay([...snap.picks])
    },
    async submitPick(input): Promise<SubmitPickResult> {
      const v = ctx.viewer()
      if (v.playerId !== input.playerId) {
        throw new DataError('FORBIDDEN', 'You can only make your own pick.', { status: 403 })
      }
      const snap = store.snapshot()
      const now = ctx.clock.now()
      const evaluation = evaluateSeason(snap, { now })
      const result = validatePick(snap, evaluation, input, now)
      if (!result.ok) return { ok: false, violations: result.violations }
      const at = now.toISOString()
      const pick = upsert(input, result.game, 'player', at)
      const team = NFL_TEAMS.find((t) => t.id === pick.teamId)
      store.audit({
        at,
        actorPlayerId: input.playerId,
        type: result.existing ? 'pick.changed' : 'pick.submitted',
        summary: `Week ${input.week}: riding with ${team?.fullName ?? pick.teamId}`,
      })
      return { ok: true, pick }
    },
    async commissionerSetPick(input) {
      const actor = requireCommissioner(ctx)
      const snap = store.snapshot()
      const game = snap.games.find(
        (g) =>
          g.week === input.week &&
          (g.homeTeamId === input.teamId.toUpperCase() ||
            g.awayTeamId === input.teamId.toUpperCase()),
      )
      if (!game)
        throw new DataError(
          'TEAM_NOT_PLAYING',
          `${input.teamId} does not play in week ${input.week}.`,
          { status: 422 },
        )
      const at = ctx.clock.now().toISOString()
      const before =
        snap.picks.find((p) => p.playerId === input.playerId && p.week === input.week) ?? null
      const pick = upsert(input, game, 'commissioner', at)
      store.override({
        type: 'pick',
        targetId: pick.id,
        before,
        after: pick,
        reason: input.reason,
        actorPlayerId: actor,
        createdAt: at,
      })
      const name =
        snap.profiles.find((p) => p.playerId === input.playerId)?.displayName ?? input.playerId
      store.audit({
        at,
        actorPlayerId: actor,
        type: 'pick.overridden',
        summary: `${name} week ${input.week} set to ${pick.teamId}: ${input.reason}`,
      })
      return pick
    },
    async commissionerClearPick(seasonId, playerId, week, reason) {
      const actor = requireCommissioner(ctx)
      const at = ctx.clock.now().toISOString()
      const before =
        store
          .snapshot()
          .picks.find(
            (p) => p.seasonId === seasonId && p.playerId === playerId && p.week === week,
          ) ?? null
      store.update((d) => {
        d.snapshot.picks = d.snapshot.picks.filter(
          (p) => !(p.seasonId === seasonId && p.playerId === playerId && p.week === week),
        )
      })
      store.override({
        type: 'pick',
        targetId: before?.id ?? `${playerId}:${week}`,
        before,
        after: null,
        reason,
        actorPlayerId: actor,
        createdAt: at,
      })
      store.audit({
        at,
        actorPlayerId: actor,
        type: 'pick.cleared',
        summary: `${playerId} week ${week} pick cleared: ${reason}`,
      })
    },
    async importPicks(seasonId, picks, reason) {
      const actor = requireCommissioner(ctx)
      const at = ctx.clock.now().toISOString()
      let imported = 0
      store.update((d) => {
        for (const pick of picks) {
          if (pick.seasonId !== seasonId) continue
          const i = d.snapshot.picks.findIndex(
            (p) => p.playerId === pick.playerId && p.week === pick.week,
          )
          if (i >= 0) d.snapshot.picks[i] = { ...pick, version: d.snapshot.picks[i]!.version + 1 }
          else d.snapshot.picks.push(pick)
          imported += 1
        }
      })
      store.override({
        type: 'import',
        targetId: seasonId,
        before: null,
        after: { count: imported },
        reason,
        actorPlayerId: actor,
        createdAt: at,
      })
      store.audit({
        at,
        actorPlayerId: actor,
        type: 'picks.imported',
        summary: `${imported} historical picks imported: ${reason}`,
      })
      return { imported }
    },
  }
}

export function createDemoNFLProvider(
  ctx: Ctx,
  espn: EspnClient = createEspnClient(),
): NFLDataProvider {
  const { store } = ctx
  const games = () => store.snapshot().games
  return {
    name: 'ESPN public scoreboard',
    async getTeams(): Promise<NFLTeam[]> {
      return [...NFL_TEAMS]
    },
    async getWeeks(seasonYear): Promise<NFLWeek[]> {
      return store.snapshot().weeks.filter((w) => w.seasonYear === seasonYear)
    },
    async getSchedule(seasonYear, week) {
      return games().filter((g) => g.seasonYear === seasonYear && g.week === week)
    },
    async getGame(gameId) {
      return games().find((g) => g.id === gameId) ?? null
    },
    async getFinalResults(seasonYear, week) {
      return games().filter(
        (g) => g.seasonYear === seasonYear && g.week === week && g.status === 'final',
      )
    },
    async recordManualResult(input: GameResultInput, reason) {
      const actor = requireCommissioner(ctx)
      const at = ctx.clock.now().toISOString()
      const game = games().find((g) => g.id === input.gameId)
      if (!game) throw new DataError('NOT_FOUND', 'Game not found', { status: 404 })
      const outcome = applyGameResult(game, { ...input, source: 'commissioner', observedAt: at })
      if (outcome.changed) {
        store.update((d) => {
          const i = d.snapshot.games.findIndex((g) => g.id === input.gameId)
          if (i >= 0) d.snapshot.games[i] = outcome.game
        })
        store.audit({
          at,
          actorPlayerId: actor,
          type: 'game.manual_result',
          summary: `Manual result for ${game.awayTeamId} @ ${game.homeTeamId}: ${reason}`,
        })
      }
      return outcome.game
    },
    /**
     * Pulls the real schedule and live scores for one week straight from ESPN
     * (the browser can call it: the endpoint sends `access-control-allow-origin: *`).
     *
     * The seeded schedule is a placeholder, so the first sync for a week
     * REPLACES it with the real slate and re-points that week's picks at the
     * real games by team — otherwise a pick would reference a game id that no
     * longer exists and would read as "no game" forever.
     *
     * Re-syncing is idempotent: unchanged games are skipped, and a result the
     * commissioner entered by hand is never overwritten (applyGameResults
     * enforces both).
     */
    async syncResults(seasonYear, week) {
      const parsed = await espn.fetchWeek(seasonYear, week)
      const at = ctx.clock.now().toISOString()
      const snap = store.snapshot()
      const weekRow = snap.weeks.find((w) => w.seasonYear === seasonYear && w.week === week)
      const wasPlaceholder = weekRow?.source !== 'provider'
      const existing = snap.games.filter((g) => g.seasonYear === seasonYear && g.week === week)

      // Base games to merge onto: the real ones we already hold, plus any the
      // provider is reporting for the first time (inserted as scheduled so the
      // result pass below applies scores through the idempotent path).
      const byId = new Map(wasPlaceholder ? [] : existing.map((g) => [g.id, g]))
      let created = 0
      for (const g of parsed.games) {
        if (byId.has(g.id)) continue
        byId.set(g.id, {
          ...g,
          status: 'scheduled',
          homeScore: undefined,
          awayScore: undefined,
          winnerTeamId: undefined,
          resultVersion: 0,
          resultSource: undefined,
        })
        created += 1
      }

      const updates: GameResultUpdate[] = parsed.games.map((g) => ({
        gameId: g.id,
        status: g.status,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        winnerTeamId: g.status === 'final' ? (g.winnerTeamId ?? undefined) : undefined,
        kickoffAt: g.kickoffAt,
        source: 'provider',
        observedAt: at,
      }))
      const merged = applyGameResults([...byId.values()], updates)

      // Re-point this week's picks at the real games, by team.
      const gameForTeam = (teamId: string) =>
        merged.games.find((g) => g.homeTeamId === teamId || g.awayTeamId === teamId) ?? null
      let relinkedPicks = 0
      const orphanedPicks: string[] = []
      for (const pick of snap.picks.filter((p) => p.week === week)) {
        const game = gameForTeam(pick.teamId)
        if (!game) {
          const name =
            snap.profiles.find((pr) => pr.playerId === pick.playerId)?.displayName ?? pick.playerId
          orphanedPicks.push(`${name} (${pick.teamId})`)
        } else if (game.id !== pick.gameId) {
          relinkedPicks += 1
        }
      }

      store.update((d) => {
        d.snapshot.games = [
          ...d.snapshot.games.filter((g) => !(g.seasonYear === seasonYear && g.week === week)),
          ...merged.games,
        ]
        const i = d.snapshot.weeks.findIndex((w) => w.seasonYear === seasonYear && w.week === week)
        if (i >= 0) d.snapshot.weeks[i] = parsed.week
        else d.snapshot.weeks.push(parsed.week)
        for (const pick of d.snapshot.picks) {
          if (pick.week !== week) continue
          const game = merged.games.find(
            (g) => g.homeTeamId === pick.teamId || g.awayTeamId === pick.teamId,
          )
          if (game && game.id !== pick.gameId) pick.gameId = game.id
        }
      })

      // Only record a sync that did something. The league page polls itself
      // while games are on, so auditing every no-op would bury the real
      // entries under hundreds of "nothing happened" lines by Sunday evening.
      const viewer = ctx.viewer()
      if (merged.changed.length > 0 || created > 0) {
        store.audit({
          at,
          actorPlayerId: viewer.playerId,
          type: 'results.synced',
          summary: `Week ${week} synced from ${parsed.week.source === 'provider' ? 'ESPN' : 'the provider'}: ${merged.changed.length} changed, ${created} added${relinkedPicks ? `, ${relinkedPicks} picks re-linked` : ''}`,
        })
      }

      return {
        changed: merged.changed.length,
        skipped: merged.skipped.length,
        created,
        relinkedPicks,
        orphanedPicks,
        liveDetail: parsed.liveDetail,
        provider: 'ESPN public scoreboard',
        observedAt: at,
      }
    },
    async putSchedule(seasonYear, week, incoming) {
      const actor = requireCommissioner(ctx)
      const playing = new Set<string>()
      for (const g of incoming) {
        if (g.seasonYear !== seasonYear || g.week !== week)
          throw new DataError('VALIDATION', `Game ${g.id} is not in ${seasonYear} week ${week}.`, {
            status: 400,
          })
        if (playing.has(g.homeTeamId) || playing.has(g.awayTeamId))
          throw new DataError('VALIDATION', `A team appears twice in week ${week}.`, {
            status: 400,
          })
        playing.add(g.homeTeamId).add(g.awayTeamId)
      }
      store.update((d) => {
        const keep = d.snapshot.games.filter(
          (g) => !(g.seasonYear === seasonYear && g.week === week),
        )
        const existing = new Map(
          d.snapshot.games
            .filter((g) => g.seasonYear === seasonYear && g.week === week)
            .map((g) => [g.id, g]),
        )
        d.snapshot.games = [
          ...keep,
          ...incoming.map((g) => ({
            ...g,
            resultVersion: existing.get(g.id)?.resultVersion ?? g.resultVersion,
          })),
        ]
        const i = d.snapshot.weeks.findIndex((w) => w.seasonYear === seasonYear && w.week === week)
        const weekRow = {
          seasonYear,
          week,
          label: `Week ${week}`,
          byeTeamIds: NFL_TEAMS.map((t) => t.id).filter((t) => !playing.has(t)),
          source: 'manual' as const,
        }
        if (i >= 0) d.snapshot.weeks[i] = weekRow
        else d.snapshot.weeks.push(weekRow)
      })
      store.audit({
        at: ctx.clock.now().toISOString(),
        actorPlayerId: actor,
        type: 'schedule.entered',
        summary: `Week ${week} schedule entered manually (${incoming.length} games)`,
      })
      return { saved: incoming.length }
    },
  }
}

export function createDemoImageRepository(ctx: Ctx): ImageRepository {
  const { store } = ctx
  const defaultUrl = `${ctx.assetBase}headshots/default.svg`
  return {
    variantUrl(image, variant) {
      if (!image) return defaultUrl
      const key = image.variants[variant]
      if (/^(data:|blob:|https?:)/.test(key)) return key
      return `${ctx.assetBase}${key.replace(/^\/+/, '')}`
    },
    defaultAvatarUrl: () => defaultUrl,
    async requestUpload(playerId, meta): Promise<ImageUploadTicket> {
      requireCommissioner(ctx)
      validateImageMeta(meta)
      const imageId = `img-${playerId}-${Date.now()}`
      // Demo "uploads" are stored as data URLs in localStorage by uploadVariant.
      return {
        imageId,
        uploads: {
          thumb: { url: `demo://${imageId}/thumb`, fields: {} },
          medium: { url: `demo://${imageId}/medium`, fields: {} },
        },
      }
    },
    async uploadVariant(target, blob) {
      const m = target.url.match(/^demo:\/\/([^/]+)\/(thumb|medium)$/)
      if (!m) throw new DataError('BAD_TARGET', 'Not a demo upload target')
      const dataUrl = await blobToDataUrl(blob)
      pendingUploads.set(`${m[1]}/${m[2]}`, dataUrl)
    },
    async finalizeUpload(playerId, imageId, meta): Promise<PlayerImage> {
      const actor = requireCommissioner(ctx)
      validateImageMeta(meta)
      const thumb = pendingUploads.get(`${imageId}/thumb`)
      const medium = pendingUploads.get(`${imageId}/medium`)
      if (!thumb || !medium)
        throw new DataError(
          'UPLOAD_INCOMPLETE',
          'Both image variants must be uploaded before finalizing.',
          { status: 409 },
        )
      const at = ctx.clock.now().toISOString()
      const image: PlayerImage = {
        id: imageId,
        playerId,
        contentType: meta.contentType,
        sizeBytes: meta.sizeBytes,
        width: meta.width,
        height: meta.height,
        variants: { thumb, medium },
        createdAt: at,
      }
      store.update((d) => {
        d.snapshot.images = [...d.snapshot.images.filter((i) => i.playerId !== playerId), image]
        const profile = d.snapshot.profiles.find((p) => p.playerId === playerId)
        if (profile) profile.imageId = imageId
      })
      pendingUploads.delete(`${imageId}/thumb`)
      pendingUploads.delete(`${imageId}/medium`)
      store.audit({
        at,
        actorPlayerId: actor,
        type: 'image.updated',
        summary: `Headshot updated for ${playerId}`,
      })
      return image
    },
    async removeImage(playerId) {
      const actor = requireCommissioner(ctx)
      store.update((d) => {
        d.snapshot.images = d.snapshot.images.filter((i) => i.playerId !== playerId)
        const profile = d.snapshot.profiles.find((p) => p.playerId === playerId)
        if (profile) profile.imageId = null
      })
      store.audit({
        at: ctx.clock.now().toISOString(),
        actorPlayerId: actor,
        type: 'image.removed',
        summary: `Headshot removed for ${playerId}`,
      })
    },
  }
}

const pendingUploads = new Map<string, string>()

export function validateImageMeta(meta: { contentType: string; sizeBytes: number }): void {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(meta.contentType)) {
    throw new DataError('UNSUPPORTED_IMAGE_TYPE', 'Headshots must be JPG, PNG or WebP.', {
      status: 415,
    })
  }
  if (meta.sizeBytes <= 0 || meta.sizeBytes > 5 * 1024 * 1024) {
    throw new DataError('IMAGE_TOO_LARGE', 'Headshots must be 5 MB or smaller.', { status: 413 })
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new DataError('READ_FAILED', 'Could not read the image.'))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(blob)
  })
}
