import { z } from 'zod'
import {
  IdSchema,
  MembershipRoleSchema,
  MembershipStatusSchema,
  PlayerProfileSchema,
  type LeagueMembership,
  type PlayerProfile,
} from '@domain/index'
import type { Context, Router } from '../app'
import { HttpError, json, parseBody } from '../lib/http'
import { createUploadTicket, deleteImageObjects, finalizeImage } from '../lib/images'
import { audit, recordOverride } from './league'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function requireSelfOrCommissioner(ctx: Context, playerId: string) {
  const actor = await ctx.requireActor()
  if (actor.playerId === playerId) return actor
  const league = await ctx.repo.getLeague(ctx.env.defaultLeagueId)
  if (league && (await ctx.isCommissioner(league, actor.playerId))) return actor
  throw new HttpError(403, 'FORBIDDEN', 'You can only edit your own profile.')
}

export function registerPlayerRoutes(router: Router): void {
  router.add('GET', '/me', async (ctx) => {
    const actor = await ctx.requireActor()
    const league = await ctx.repo.getLeague(ctx.env.defaultLeagueId)
    const isCommissioner = league ? await ctx.isCommissioner(league, actor.playerId) : false
    return json(200, { playerId: actor.playerId, displayName: actor.displayName, isCommissioner })
  })

  router.add('GET', '/seasons/:seasonId/members', async (ctx) => {
    const { league, season } = await ctx.loadLeagueSeason(ctx.params.seasonId!)
    return json(200, await ctx.repo.listMemberships(league.id, season.id))
  })

  router.add('POST', '/seasons/:seasonId/members', async (ctx) => {
    const { league, season } = await ctx.loadLeagueSeason(ctx.params.seasonId!)
    const { actor } = await ctx.requireCommissioner(league.id)
    const body = parseBody(
      ctx.event,
      z.object({
        displayName: z.string().min(1).max(60),
        nickname: z.string().max(40).optional(),
        email: z.email().optional(),
        role: MembershipRoleSchema.default('player'),
      }),
    )
    const existing = await ctx.repo.listMemberships(league.id, season.id)
    let playerId = slugify(body.displayName) || `player-${existing.length + 1}`
    if (existing.some((m) => m.playerId === playerId) || (await ctx.repo.getProfile(playerId)))
      playerId = `${playerId}-${ctx.newId().slice(0, 6)}`
    const at = ctx.now().toISOString()
    const membership: LeagueMembership = {
      id: `m-${playerId}`,
      leagueId: league.id,
      seasonId: season.id,
      playerId,
      role: body.role,
      status: 'active',
      joinedAt: at,
    }
    const profile: PlayerProfile = {
      playerId,
      displayName: body.displayName,
      nickname: body.nickname,
      imageId: null,
    }
    await ctx.repo.putProfile({ ...profile, email: body.email?.toLowerCase() })
    await ctx.repo.putMembership(membership)
    await recordOverride(ctx, {
      leagueId: league.id,
      seasonId: season.id,
      type: 'membership',
      targetId: membership.id,
      before: null,
      after: membership,
      reason: 'added by commissioner',
      actorPlayerId: actor.playerId,
    })
    await audit(
      ctx,
      league.id,
      actor.playerId,
      'member.added',
      `${body.displayName} joined the league`,
    )
    return json(201, { membership, profile })
  })

  router.add('PATCH', '/members/:membershipId', async (ctx) => {
    const league = await ctx.repo.getLeague(ctx.env.defaultLeagueId)
    if (!league) throw new HttpError(404, 'NOT_FOUND', 'League not found')
    const { season, actor } = await ctx.requireCommissioner(league.id)
    const body = parseBody(
      ctx.event,
      z.object({
        status: MembershipStatusSchema.optional(),
        role: MembershipRoleSchema.optional(),
        livesOverride: z.number().int().min(1).max(10).nullable().optional(),
        reason: z.string().max(300).default('commissioner edit'),
      }),
    )
    const before = await ctx.repo.findMembershipById(league.id, season.id, ctx.params.membershipId!)
    if (!before) throw new HttpError(404, 'NOT_FOUND', 'Membership not found')
    const after: LeagueMembership = { ...before }
    if (body.status) after.status = body.status
    if (body.role) after.role = body.role
    if (body.livesOverride !== undefined) {
      if (body.livesOverride === null) delete after.livesOverride
      else after.livesOverride = body.livesOverride
    }
    await ctx.repo.putMembership(after)
    await recordOverride(ctx, {
      leagueId: league.id,
      seasonId: season.id,
      type: body.livesOverride !== undefined ? 'lives' : 'membership',
      targetId: before.id,
      before,
      after,
      reason: body.reason,
      actorPlayerId: actor.playerId,
    })
    await audit(
      ctx,
      league.id,
      actor.playerId,
      'member.updated',
      `${before.playerId}: ${body.reason}`,
    )
    return json(200, after)
  })

  router.add('GET', '/players/:playerId/profile', async (ctx) => {
    const profile = await ctx.repo.getProfile(ctx.params.playerId!)
    if (!profile) throw new HttpError(404, 'NOT_FOUND', 'Player not found')
    const { email: _email, ...publicProfile } = profile
    return json(200, publicProfile)
  })

  router.add('PUT', '/players/:playerId/profile', async (ctx) => {
    const playerId = ctx.params.playerId!
    const actor = await requireSelfOrCommissioner(ctx, playerId)
    const body = parseBody(ctx.event, PlayerProfileSchema.omit({ playerId: true, imageId: true }))
    const current = await ctx.repo.getProfile(playerId)
    if (!current) throw new HttpError(404, 'NOT_FOUND', 'Player not found')
    const updated = { ...current, ...body, playerId }
    await ctx.repo.putProfile(updated)
    await audit(
      ctx,
      ctx.env.defaultLeagueId,
      actor.playerId,
      'profile.updated',
      `${updated.displayName}'s profile updated`,
    )
    const { email: _email, ...publicProfile } = updated
    return json(200, publicProfile)
  })

  // ---- headshots ---------------------------------------------------------
  router.add('POST', '/players/:playerId/image/upload-ticket', async (ctx) => {
    const league = await ctx.repo.getLeague(ctx.env.defaultLeagueId)
    if (!league) throw new HttpError(404, 'NOT_FOUND', 'League not found')
    await ctx.requireCommissioner(league.id)
    const playerId = ctx.params.playerId!
    if (!(await ctx.repo.getProfile(playerId)))
      throw new HttpError(404, 'NOT_FOUND', 'Player not found')
    const meta = parseBody(ctx.event, z.object({ contentType: z.string(), sizeBytes: z.number() }))
    return json(200, await createUploadTicket(ctx.storage, playerId, meta, ctx.newId))
  })

  router.add('POST', '/players/:playerId/image/finalize', async (ctx) => {
    const league = await ctx.repo.getLeague(ctx.env.defaultLeagueId)
    if (!league) throw new HttpError(404, 'NOT_FOUND', 'League not found')
    const { actor } = await ctx.requireCommissioner(league.id)
    const playerId = ctx.params.playerId!
    const profile = await ctx.repo.getProfile(playerId)
    if (!profile) throw new HttpError(404, 'NOT_FOUND', 'Player not found')
    const body = parseBody(
      ctx.event,
      z.object({
        imageId: IdSchema,
        contentType: z.string(),
        sizeBytes: z.number(),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      }),
    )
    const image = await finalizeImage(ctx.storage, { ...body, playerId }, ctx.now().toISOString())
    const previous = (await ctx.repo.listImages([playerId])).filter((i) => i.id !== image.id)
    await ctx.repo.putImage(image)
    await ctx.repo.putProfile({ ...profile, imageId: image.id })
    for (const old of previous) {
      await ctx.repo.deleteImage(playerId, old.id)
      await deleteImageObjects(ctx.storage, old)
    }
    await audit(
      ctx,
      league.id,
      actor.playerId,
      'image.updated',
      `Headshot updated for ${profile.displayName}`,
    )
    return json(200, image)
  })

  router.add('DELETE', '/players/:playerId/image', async (ctx) => {
    const league = await ctx.repo.getLeague(ctx.env.defaultLeagueId)
    if (!league) throw new HttpError(404, 'NOT_FOUND', 'League not found')
    const { actor } = await ctx.requireCommissioner(league.id)
    const playerId = ctx.params.playerId!
    const profile = await ctx.repo.getProfile(playerId)
    if (!profile) throw new HttpError(404, 'NOT_FOUND', 'Player not found')
    for (const img of await ctx.repo.listImages([playerId])) {
      await ctx.repo.deleteImage(playerId, img.id)
      await deleteImageObjects(ctx.storage, img)
    }
    await ctx.repo.putProfile({ ...profile, imageId: null })
    await audit(
      ctx,
      league.id,
      actor.playerId,
      'image.removed',
      `Headshot removed for ${profile.displayName}`,
    )
    return json(204, null)
  })
}
