import { z } from 'zod'
import {
  applyGameResult,
  GameStatusSchema,
  IdSchema,
  LeagueSettingsSchema,
  SeasonSchema,
  TeamIdSchema,
  type CommissionerOverride,
  type LeagueGameOverride,
} from '@domain/index'
import type { Context, Router } from '../app'
import { HttpError, json, parseBody } from '../lib/http'

/** League/season metadata, settings, result overrides, decisions, audit. */

export async function audit(
  ctx: Context,
  leagueId: string,
  actorPlayerId: string | null,
  type: string,
  summary: string,
  details?: Record<string, unknown>,
) {
  const at = ctx.now().toISOString()
  await ctx.repo.recordAudit({
    id: ctx.newId(),
    leagueId,
    at,
    actorPlayerId,
    type,
    summary,
    details,
  })
}

export async function recordOverride(
  ctx: Context,
  o: Omit<CommissionerOverride, 'id' | 'createdAt'>,
) {
  await ctx.repo.recordOverride({ ...o, id: ctx.newId(), createdAt: ctx.now().toISOString() })
}

export function registerLeagueRoutes(router: Router): void {
  router.add('GET', '/leagues', async (ctx) => json(200, await ctx.repo.listLeagues()))

  router.add('GET', '/leagues/:leagueId', async (ctx) => {
    const league = await ctx.repo.getLeague(ctx.params.leagueId!)
    if (!league) throw new HttpError(404, 'NOT_FOUND', 'League not found')
    return json(200, league)
  })

  router.add('GET', '/seasons/:seasonId', async (ctx) => {
    const { season } = await ctx.loadLeagueSeason(ctx.params.seasonId!)
    return json(200, season)
  })

  router.add('PUT', '/leagues/:leagueId/settings', async (ctx) => {
    const { league, actor, season } = await ctx.requireCommissioner(ctx.params.leagueId!)
    const body = parseBody(
      ctx.event,
      z.object({
        settings: LeagueSettingsSchema,
        reason: z.string().max(300).default('settings updated'),
      }),
    )
    const updated = { ...league, settings: body.settings }
    await ctx.repo.putLeague(updated)
    await recordOverride(ctx, {
      leagueId: league.id,
      seasonId: season.id,
      type: 'settings',
      targetId: league.id,
      before: league.settings,
      after: body.settings,
      reason: body.reason,
      actorPlayerId: actor.playerId,
    })
    await audit(
      ctx,
      league.id,
      actor.playerId,
      'settings.updated',
      `League settings updated: ${body.reason}`,
    )
    return json(200, updated)
  })

  router.add('PATCH', '/seasons/:seasonId', async (ctx) => {
    const { league, season } = await ctx.loadLeagueSeason(ctx.params.seasonId!)
    const { actor } = await ctx.requireCommissioner(league.id)
    const patch = parseBody(
      ctx.event,
      SeasonSchema.pick({
        label: true,
        status: true,
        startWeek: true,
        endWeek: true,
        notes: true,
      }).partial(),
    )
    const updated = SeasonSchema.parse({ ...season, ...patch })
    if (updated.endWeek < updated.startWeek)
      throw new HttpError(400, 'VALIDATION', 'endWeek must be >= startWeek')
    await ctx.repo.putSeason(updated)
    await audit(
      ctx,
      league.id,
      actor.playerId,
      'season.updated',
      `Season ${season.id} updated (${Object.keys(patch).join(', ')})`,
    )
    return json(200, updated)
  })

  router.add('POST', '/leagues/:leagueId/games/:gameId/override', async (ctx) => {
    const { league, season, actor } = await ctx.requireCommissioner(ctx.params.leagueId!)
    const body = parseBody(
      ctx.event,
      z.object({
        status: GameStatusSchema,
        homeScore: z.number().int().min(0).optional(),
        awayScore: z.number().int().min(0).optional(),
        winnerTeamId: TeamIdSchema.nullable().optional(),
        reason: z.string().min(1).max(300),
      }),
    )
    const game = await ctx.repo.findGame(ctx.params.gameId!, season.year)
    if (!game) throw new HttpError(404, 'NOT_FOUND', 'Game not found')
    const at = ctx.now().toISOString()
    // The result engine validates winner/score consistency.
    const outcome = applyGameResult(game, {
      gameId: game.id,
      ...body,
      source: 'commissioner',
      observedAt: at,
    })
    const override: LeagueGameOverride = {
      leagueId: league.id,
      gameId: game.id,
      status: outcome.game.status,
      homeScore: outcome.game.homeScore,
      awayScore: outcome.game.awayScore,
      winnerTeamId: outcome.game.winnerTeamId,
      reason: body.reason,
      actorPlayerId: actor.playerId,
      createdAt: at,
    }
    const before =
      (await ctx.repo.listGameOverrides(league.id)).find((o) => o.gameId === game.id) ?? game
    await ctx.repo.putGameOverride(override)
    await recordOverride(ctx, {
      leagueId: league.id,
      seasonId: season.id,
      type: 'game_result',
      targetId: game.id,
      before,
      after: override,
      reason: body.reason,
      actorPlayerId: actor.playerId,
    })
    await audit(
      ctx,
      league.id,
      actor.playerId,
      'game.overridden',
      `Result of ${game.awayTeamId} @ ${game.homeTeamId} (week ${game.week}) overridden: ${body.reason}`,
    )
    return json(200, override)
  })

  router.add('DELETE', '/leagues/:leagueId/games/:gameId/override', async (ctx) => {
    const { league, season, actor } = await ctx.requireCommissioner(ctx.params.leagueId!)
    const body = parseBody(
      ctx.event,
      z.object({ reason: z.string().max(300).default('correction withdrawn') }),
    )
    const before =
      (await ctx.repo.listGameOverrides(league.id)).find((o) => o.gameId === ctx.params.gameId) ??
      null
    await ctx.repo.deleteGameOverride(league.id, ctx.params.gameId!)
    await recordOverride(ctx, {
      leagueId: league.id,
      seasonId: season.id,
      type: 'game_result',
      targetId: ctx.params.gameId!,
      before,
      after: null,
      reason: body.reason,
      actorPlayerId: actor.playerId,
    })
    await audit(
      ctx,
      league.id,
      actor.playerId,
      'game.override_cleared',
      `Override on ${ctx.params.gameId} cleared: ${body.reason}`,
    )
    return json(204, null)
  })

  router.add('POST', '/seasons/:seasonId/decision', async (ctx) => {
    const { league, season } = await ctx.loadLeagueSeason(ctx.params.seasonId!)
    const { actor } = await ctx.requireCommissioner(league.id)
    const body = parseBody(
      ctx.event,
      z.object({ championPlayerIds: z.array(IdSchema).min(1), reason: z.string().min(1).max(300) }),
    )
    const members = await ctx.repo.listMemberships(league.id, season.id)
    for (const id of body.championPlayerIds) {
      if (!members.some((m) => m.playerId === id))
        throw new HttpError(400, 'VALIDATION', `${id} is not a member of this season`)
    }
    const decision = {
      seasonId: season.id,
      championPlayerIds: body.championPlayerIds,
      reason: body.reason,
      actorPlayerId: actor.playerId,
      decidedAt: ctx.now().toISOString(),
    }
    const before = await ctx.repo.getDecision(season.id)
    await ctx.repo.putDecision(decision)
    await recordOverride(ctx, {
      leagueId: league.id,
      seasonId: season.id,
      type: 'champion',
      targetId: season.id,
      before,
      after: decision,
      reason: body.reason,
      actorPlayerId: actor.playerId,
    })
    await audit(
      ctx,
      league.id,
      actor.playerId,
      'season.decided',
      `Champion(s) recorded: ${body.championPlayerIds.join(', ')} — ${body.reason}`,
    )
    return json(200, decision)
  })

  router.add('GET', '/seasons/:seasonId/overrides', async (ctx) => {
    const { league, season } = await ctx.loadLeagueSeason(ctx.params.seasonId!)
    await ctx.requireCommissioner(league.id)
    return json(200, await ctx.repo.listOverrides(league.id, season.id))
  })

  router.add('GET', '/leagues/:leagueId/audit', async (ctx) => {
    await ctx.requireCommissioner(ctx.params.leagueId!)
    const limit = Math.min(Number(ctx.query.limit ?? 100) || 100, 500)
    return json(200, await ctx.repo.listAudit(ctx.params.leagueId!, limit))
  })
}
