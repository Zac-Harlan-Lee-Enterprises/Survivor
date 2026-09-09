import { z } from 'zod'
import {
  evaluateSeason,
  gameInvolves,
  getTeam,
  PickSchema,
  redactSnapshot,
  TeamIdSchema,
  validatePick,
  WeekNumberSchema,
  type Pick,
} from '@domain/index'
import type { Router } from '../app'
import { HttpError, json, parseBody } from '../lib/http'
import { ConditionFailed } from '../lib/store'
import { audit, recordOverride } from './league'

/**
 * Picks. THIS is where the survivor rules are enforced for real: the same
 * validatePick() the browser uses to shape the UI runs here against the
 * authoritative snapshot and the server clock, and the write is conditional
 * on the pick version so two tabs (or a double tap) cannot race.
 */

export function registerPickRoutes(router: Router): void {
  router.add('GET', '/seasons/:seasonId/snapshot', async (ctx) => {
    const { league, season } = await ctx.loadLeagueSeason(ctx.params.seasonId!)
    const actor = await ctx.actor()
    const snapshot = await ctx.repo.loadSnapshot(league, season)
    const viewer = {
      playerId: actor?.playerId ?? null,
      isCommissioner: await ctx.isCommissioner(league, actor?.playerId ?? null),
    }
    // Profiles never leak emails; strip anything beyond the public profile shape.
    return json(200, redactSnapshot(snapshot, viewer, ctx.now()))
  })

  router.add('GET', '/seasons/:seasonId/picks', async (ctx) => {
    const { league, season } = await ctx.loadLeagueSeason(ctx.params.seasonId!)
    const actor = await ctx.actor()
    const snapshot = await ctx.repo.loadSnapshot(league, season)
    const viewer = {
      playerId: actor?.playerId ?? null,
      isCommissioner: await ctx.isCommissioner(league, actor?.playerId ?? null),
    }
    return json(200, redactSnapshot(snapshot, viewer, ctx.now()).picks)
  })

  /**
   * Unredacted picks, for administration only. Kept off the snapshot so a
   * competing commissioner does not get a free look at rivals' picks.
   */
  router.add('GET', '/seasons/:seasonId/picks/all', async (ctx) => {
    const { league, season } = await ctx.loadLeagueSeason(ctx.params.seasonId!)
    await ctx.requireCommissioner(league.id)
    return json(200, await ctx.repo.listPicks(season.id))
  })

  router.add('PUT', '/seasons/:seasonId/picks/:week', async (ctx) => {
    const actor = await ctx.requireActor()
    const { league, season } = await ctx.loadLeagueSeason(ctx.params.seasonId!)
    const week = WeekNumberSchema.parse(Number(ctx.params.week))
    const body = parseBody(
      ctx.event,
      z.object({ teamId: TeamIdSchema, expectedVersion: z.number().int().min(1).optional() }),
    )
    const now = ctx.now()
    const snapshot = await ctx.repo.loadSnapshot(league, season)
    const evaluation = evaluateSeason(snapshot, { now })
    const result = validatePick(
      snapshot,
      evaluation,
      {
        playerId: actor.playerId,
        week,
        teamId: body.teamId,
        expectedVersion: body.expectedVersion,
      },
      now,
    )
    if (!result.ok) return json(422, { ok: false, violations: result.violations })

    const teamId = body.teamId.toUpperCase()
    const at = now.toISOString()
    // Idempotent re-submit of the same team: return the existing pick unchanged.
    if (result.existing && result.existing.teamId === teamId)
      return json(200, { ok: true, pick: result.existing })

    const pick: Pick = result.existing
      ? {
          ...result.existing,
          teamId,
          gameId: result.game.id,
          updatedAt: at,
          version: result.existing.version + 1,
          source: 'player',
        }
      : {
          id: `pick-${actor.playerId}-${week}`,
          leagueId: league.id,
          seasonId: season.id,
          playerId: actor.playerId,
          week,
          teamId,
          gameId: result.game.id,
          submittedAt: at,
          updatedAt: at,
          version: 1,
          source: 'player',
        }
    try {
      await ctx.repo.savePick(pick, result.existing ? result.existing.version : null)
    } catch (err) {
      if (err instanceof ConditionFailed) {
        return json(409, {
          ok: false,
          violations: [
            {
              code: 'VERSION_CONFLICT',
              message: 'Your pick changed somewhere else. Refresh and try again.',
            },
          ],
        })
      }
      throw err
    }
    await audit(
      ctx,
      league.id,
      actor.playerId,
      result.existing ? 'pick.changed' : 'pick.submitted',
      `Week ${week}: riding with ${getTeam(teamId)?.fullName ?? teamId}`,
    )
    return json(200, { ok: true, pick })
  })

  router.add('PUT', '/seasons/:seasonId/players/:playerId/picks/:week', async (ctx) => {
    const { league, season } = await ctx.loadLeagueSeason(ctx.params.seasonId!)
    const { actor } = await ctx.requireCommissioner(league.id)
    const week = WeekNumberSchema.parse(Number(ctx.params.week))
    const body = parseBody(
      ctx.event,
      z.object({ teamId: TeamIdSchema, reason: z.string().min(1).max(300) }),
    )
    const teamId = body.teamId.toUpperCase()
    const playerId = ctx.params.playerId!
    const member = await ctx.repo.getMembership(league.id, season.id, playerId)
    if (!member) throw new HttpError(404, 'NOT_FOUND', 'Player is not in this season')
    const games = await ctx.repo.listGames(season.year, week)
    const game = games.find((g) => gameInvolves(g, teamId))
    if (!game)
      throw new HttpError(422, 'TEAM_NOT_PLAYING', `${teamId} does not play in week ${week}.`)
    const existing =
      (await ctx.repo.listPicks(season.id)).find(
        (p) => p.playerId === playerId && p.week === week,
      ) ?? null
    const at = ctx.now().toISOString()
    const pick: Pick = existing
      ? {
          ...existing,
          teamId,
          gameId: game.id,
          updatedAt: at,
          version: existing.version + 1,
          source: 'commissioner',
        }
      : {
          id: `pick-${playerId}-${week}`,
          leagueId: league.id,
          seasonId: season.id,
          playerId,
          week,
          teamId,
          gameId: game.id,
          submittedAt: at,
          updatedAt: at,
          version: 1,
          source: 'commissioner',
        }
    await ctx.repo.forcePick(pick)
    await recordOverride(ctx, {
      leagueId: league.id,
      seasonId: season.id,
      type: 'pick',
      targetId: pick.id,
      before: existing,
      after: pick,
      reason: body.reason,
      actorPlayerId: actor.playerId,
    })
    await audit(
      ctx,
      league.id,
      actor.playerId,
      'pick.overridden',
      `${playerId} week ${week} set to ${teamId}: ${body.reason}`,
    )
    return json(200, pick)
  })

  router.add('DELETE', '/seasons/:seasonId/players/:playerId/picks/:week', async (ctx) => {
    const { league, season } = await ctx.loadLeagueSeason(ctx.params.seasonId!)
    const { actor } = await ctx.requireCommissioner(league.id)
    const week = WeekNumberSchema.parse(Number(ctx.params.week))
    const body = parseBody(
      ctx.event,
      z.object({ reason: z.string().max(300).default('cleared by commissioner') }),
    )
    const playerId = ctx.params.playerId!
    const existing =
      (await ctx.repo.listPicks(season.id)).find(
        (p) => p.playerId === playerId && p.week === week,
      ) ?? null
    await ctx.repo.deletePick(season.id, playerId, week)
    await recordOverride(ctx, {
      leagueId: league.id,
      seasonId: season.id,
      type: 'pick',
      targetId: existing?.id ?? `${playerId}:${week}`,
      before: existing,
      after: null,
      reason: body.reason,
      actorPlayerId: actor.playerId,
    })
    await audit(
      ctx,
      league.id,
      actor.playerId,
      'pick.cleared',
      `${playerId} week ${week} pick cleared: ${body.reason}`,
    )
    return json(204, null)
  })

  router.add('POST', '/seasons/:seasonId/picks/import', async (ctx) => {
    const { league, season } = await ctx.loadLeagueSeason(ctx.params.seasonId!)
    const { actor } = await ctx.requireCommissioner(league.id)
    const body = parseBody(
      ctx.event,
      z.object({
        picks: z.array(PickSchema).max(2000),
        reason: z.string().max(300).default('import'),
      }),
    )
    const members = new Set(
      (await ctx.repo.listMemberships(league.id, season.id)).map((m) => m.playerId),
    )
    const existing = await ctx.repo.listPicks(season.id)
    let imported = 0
    for (const raw of body.picks) {
      if (raw.seasonId !== season.id || !members.has(raw.playerId)) continue
      const prev = existing.find((p) => p.playerId === raw.playerId && p.week === raw.week)
      await ctx.repo.forcePick({
        ...raw,
        leagueId: league.id,
        source: 'import',
        version: prev ? prev.version + 1 : 1,
      })
      imported += 1
    }
    await recordOverride(ctx, {
      leagueId: league.id,
      seasonId: season.id,
      type: 'import',
      targetId: season.id,
      before: null,
      after: { count: imported },
      reason: body.reason,
      actorPlayerId: actor.playerId,
    })
    await audit(
      ctx,
      league.id,
      actor.playerId,
      'picks.imported',
      `${imported} historical picks imported: ${body.reason}`,
    )
    return json(200, { imported })
  })
}
