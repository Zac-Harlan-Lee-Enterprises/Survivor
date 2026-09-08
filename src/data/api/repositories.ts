import { z } from 'zod'
import {
  AuditEventSchema,
  CommissionerOverrideSchema,
  LeagueGameOverrideSchema,
  LeagueMembershipSchema,
  LeagueSchema,
  NFLGameSchema,
  NFLTeamSchema,
  NFLWeekSchema,
  PickSchema,
  PlayerImageSchema,
  PlayerProfileSchema,
  SeasonDecisionSchema,
  SeasonSchema,
  SeasonSnapshotSchema,
} from '@/domain'
import type {
  ImageRepository,
  LeagueRepository,
  NFLDataProvider,
  PickRepository,
  PlayerRepository,
  SubmitPickResult,
} from '../interfaces'
import { DataError } from '../interfaces'
import type { HttpClient } from './http'

/** Connected-mode repositories: thin, typed wrappers over the AWS API. */

const SubmitPickResponse = z.union([
  z.object({ ok: z.literal(true), pick: PickSchema }),
  z.object({
    ok: z.literal(false),
    violations: z.array(z.object({ code: z.string(), message: z.string() })),
  }),
])

export function createApiLeagueRepository(http: HttpClient): LeagueRepository {
  return {
    listLeagues: () =>
      http.request('/leagues', { schema: z.array(LeagueSchema), publicRead: true }),
    getLeague: (id) =>
      http.request(`/leagues/${enc(id)}`, { schema: LeagueSchema, publicRead: true }),
    getSeason: (id) =>
      http.request(`/seasons/${enc(id)}`, { schema: SeasonSchema, publicRead: true }),
    getSeasonSnapshot: (id) =>
      http.request(`/seasons/${enc(id)}/snapshot`, {
        schema: SeasonSnapshotSchema,
        publicRead: true,
      }),
    updateSettings: (leagueId, settings, reason) =>
      http.request(`/leagues/${enc(leagueId)}/settings`, {
        method: 'PUT',
        body: { settings, reason },
        schema: LeagueSchema,
      }),
    updateSeason: (seasonId, patch) =>
      http.request(`/seasons/${enc(seasonId)}`, {
        method: 'PATCH',
        body: patch,
        schema: SeasonSchema,
      }),
    overrideGameResult: (input) =>
      http.request(`/leagues/${enc(input.leagueId)}/games/${enc(input.gameId)}/override`, {
        method: 'POST',
        body: input,
        schema: LeagueGameOverrideSchema,
      }),
    clearGameOverride: async (leagueId, gameId, reason) => {
      await http.request(`/leagues/${enc(leagueId)}/games/${enc(gameId)}/override`, {
        method: 'DELETE',
        body: { reason },
      })
    },
    recordDecision: (input) =>
      http.request(`/seasons/${enc(input.seasonId)}/decision`, {
        method: 'POST',
        body: input,
        schema: SeasonDecisionSchema,
      }),
    listOverrides: (seasonId) =>
      http.request(`/seasons/${enc(seasonId)}/overrides`, {
        schema: z.array(CommissionerOverrideSchema),
      }),
    listAuditEvents: (leagueId, limit = 100) =>
      http.request(`/leagues/${enc(leagueId)}/audit?limit=${limit}`, {
        schema: z.array(AuditEventSchema),
      }),
  }
}

export function createApiPlayerRepository(http: HttpClient): PlayerRepository {
  return {
    listMemberships: (seasonId) =>
      http.request(`/seasons/${enc(seasonId)}/members`, {
        schema: z.array(LeagueMembershipSchema),
        publicRead: true,
      }),
    getProfile: (playerId) =>
      http.request(`/players/${enc(playerId)}/profile`, {
        schema: PlayerProfileSchema,
        publicRead: true,
      }),
    upsertProfile: (profile) =>
      http.request(`/players/${enc(profile.playerId)}/profile`, {
        method: 'PUT',
        body: profile,
        schema: PlayerProfileSchema,
      }),
    addMember: (input) =>
      http.request(`/seasons/${enc(input.seasonId)}/members`, {
        method: 'POST',
        body: input,
        schema: z.object({ membership: LeagueMembershipSchema, profile: PlayerProfileSchema }),
      }),
    updateMembership: (membershipId, patch, reason) =>
      http.request(`/members/${enc(membershipId)}`, {
        method: 'PATCH',
        body: { ...patch, reason },
        schema: LeagueMembershipSchema,
      }),
  }
}

export function createApiPickRepository(http: HttpClient): PickRepository {
  return {
    listPicks: (seasonId) =>
      http.request(`/seasons/${enc(seasonId)}/picks`, {
        schema: z.array(PickSchema),
        publicRead: true,
      }),
    submitPick: async (input): Promise<SubmitPickResult> =>
      http.request(`/seasons/${enc(input.seasonId)}/picks/${input.week}`, {
        method: 'PUT',
        body: { teamId: input.teamId, expectedVersion: input.expectedVersion },
        schema: SubmitPickResponse,
        okStatuses: [409, 422],
      }),
    commissionerSetPick: (input) =>
      http.request(
        `/seasons/${enc(input.seasonId)}/players/${enc(input.playerId)}/picks/${input.week}`,
        {
          method: 'PUT',
          body: { teamId: input.teamId, reason: input.reason },
          schema: PickSchema,
        },
      ),
    commissionerClearPick: async (seasonId, playerId, week, reason) => {
      await http.request(`/seasons/${enc(seasonId)}/players/${enc(playerId)}/picks/${week}`, {
        method: 'DELETE',
        body: { reason },
      })
    },
    importPicks: (seasonId, picks, reason) =>
      http.request(`/seasons/${enc(seasonId)}/picks/import`, {
        method: 'POST',
        body: { picks, reason },
        schema: z.object({ imported: z.number() }),
      }),
  }
}

export function createApiNFLProvider(http: HttpClient): NFLDataProvider {
  return {
    name: 'aws-api',
    getTeams: () =>
      http.request('/nfl/teams', { schema: z.array(NFLTeamSchema), publicRead: true }),
    getWeeks: (year) =>
      http.request(`/nfl/${year}/weeks`, { schema: z.array(NFLWeekSchema), publicRead: true }),
    getSchedule: (year, week) =>
      http.request(`/nfl/${year}/weeks/${week}/games`, {
        schema: z.array(NFLGameSchema),
        publicRead: true,
      }),
    getGame: (gameId) =>
      http.request(`/nfl/games/${enc(gameId)}`, {
        schema: NFLGameSchema.nullable(),
        okStatuses: [404],
        publicRead: true,
      }),
    getFinalResults: (year, week) =>
      http.request(`/nfl/${year}/weeks/${week}/results`, {
        schema: z.array(NFLGameSchema),
        publicRead: true,
      }),
    recordManualResult: (input, reason) =>
      http.request(`/nfl/games/${enc(input.gameId)}/manual-result`, {
        method: 'POST',
        body: { ...input, reason },
        schema: NFLGameSchema,
      }),
    syncResults: (year, week) =>
      http.request(`/nfl/${year}/weeks/${week}/sync`, {
        method: 'POST',
        schema: z.object({ changed: z.number(), skipped: z.number() }),
      }),
    putSchedule: (year, week, games) =>
      http.request(`/nfl/${year}/weeks/${week}/games`, {
        method: 'PUT',
        body: { games },
        schema: z.object({ saved: z.number() }),
      }),
  }
}

const UploadTicketSchema = z.object({
  imageId: z.string(),
  uploads: z.object({
    thumb: z.object({ url: z.string(), fields: z.record(z.string(), z.string()) }),
    medium: z.object({ url: z.string(), fields: z.record(z.string(), z.string()) }),
  }),
})

export function createApiImageRepository(
  http: HttpClient,
  imageBaseUrl: string,
  defaultAvatar: string,
): ImageRepository {
  return {
    variantUrl(image, variant) {
      if (!image) return defaultAvatar
      const key = image.variants[variant]
      // Records hold storage keys (images/<id>/<variant>.webp); absolute URLs pass through.
      return /^https?:/.test(key) ? key : `${imageBaseUrl}/${key.replace(/^\/+/, '')}`
    },
    defaultAvatarUrl: () => defaultAvatar,
    requestUpload: (playerId, meta) =>
      http.request(`/players/${enc(playerId)}/image/upload-ticket`, {
        method: 'POST',
        body: meta,
        schema: UploadTicketSchema,
      }),
    uploadVariant: (target, blob) => http.postForm(target.url, target.fields, blob),
    finalizeUpload: (playerId, imageId, meta) =>
      http.request(`/players/${enc(playerId)}/image/finalize`, {
        method: 'POST',
        body: { imageId, ...meta },
        schema: PlayerImageSchema,
      }),
    removeImage: async (playerId) => {
      await http.request(`/players/${enc(playerId)}/image`, { method: 'DELETE' })
    },
  }
}

function enc(v: string): string {
  if (!v) throw new DataError('BAD_ID', 'Missing identifier')
  return encodeURIComponent(v)
}
