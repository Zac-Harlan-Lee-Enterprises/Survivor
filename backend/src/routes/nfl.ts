import { z } from 'zod'
import {
  applyGameResult,
  GameStatusSchema,
  NFL_TEAMS,
  NFLGameSchema,
  TeamIdSchema,
  WeekNumberSchema,
  ALL_TEAM_IDS,
} from '@domain/index'
import type { Router } from '../app'
import { HttpError, json, parseBody } from '../lib/http'
import { syncWeek } from '../sync'
import { audit } from './league'

/** NFL schedule/results, manual fallback, and on-demand provider sync. */

export function registerNflRoutes(router: Router): void {
  router.add('GET', '/nfl/teams', async () => json(200, NFL_TEAMS))

  router.add('GET', '/nfl/:year/weeks', async (ctx) =>
    json(200, await ctx.repo.listWeeks(Number(ctx.params.year))),
  )

  router.add('GET', '/nfl/:year/weeks/:week/games', async (ctx) =>
    json(200, await ctx.repo.listGames(Number(ctx.params.year), Number(ctx.params.week))),
  )

  router.add('GET', '/nfl/:year/weeks/:week/results', async (ctx) =>
    json(
      200,
      (await ctx.repo.listGames(Number(ctx.params.year), Number(ctx.params.week))).filter(
        (g) => g.status === 'final',
      ),
    ),
  )

  router.add('GET', '/nfl/games/:gameId', async (ctx) => {
    const league = await ctx.repo.getLeague(ctx.env.defaultLeagueId)
    const season = league ? await ctx.repo.getSeason(league.id, league.currentSeasonId) : null
    const game = await ctx.repo.findGame(ctx.params.gameId!, season?.year)
    if (!game) return json(404, null)
    return json(200, game)
  })

  /** Commissioner enters or replaces a week's schedule by hand (provider outage, or manual mode). */
  router.add('PUT', '/nfl/:year/weeks/:week/games', async (ctx) => {
    const { league, actor } = await ctx.requireCommissioner(ctx.env.defaultLeagueId)
    const year = Number(ctx.params.year)
    const week = WeekNumberSchema.parse(Number(ctx.params.week))
    const body = parseBody(ctx.event, z.object({ games: z.array(NFLGameSchema).max(20) }))
    const playing = new Set<string>()
    for (const g of body.games) {
      if (g.seasonYear !== year || g.week !== week)
        throw new HttpError(400, 'VALIDATION', `Game ${g.id} is not in ${year} week ${week}`)
      if (playing.has(g.homeTeamId) || playing.has(g.awayTeamId))
        throw new HttpError(400, 'VALIDATION', `A team appears twice in week ${week}`)
      playing.add(g.homeTeamId).add(g.awayTeamId)
    }
    for (const g of body.games) {
      const existing = await ctx.repo.getGame(year, week, g.id)
      await ctx.repo.saveGame(existing ? { ...g, resultVersion: existing.resultVersion } : g, null)
    }
    await ctx.repo.putWeek({
      seasonYear: year,
      week,
      label: `Week ${week}`,
      byeTeamIds: ALL_TEAM_IDS.filter((t) => !playing.has(t)),
      source: 'manual',
    })
    await audit(
      ctx,
      league.id,
      actor.playerId,
      'schedule.entered',
      `Week ${week} schedule entered manually (${body.games.length} games)`,
    )
    return json(200, { saved: body.games.length })
  })

  /** Manual result: writes the game itself (commissioner-sourced, locked against provider overwrite). */
  router.add('POST', '/nfl/games/:gameId/manual-result', async (ctx) => {
    const { league, season, actor } = await ctx.requireCommissioner(ctx.env.defaultLeagueId)
    const body = parseBody(
      ctx.event,
      z.object({
        status: GameStatusSchema,
        homeScore: z.number().int().min(0).optional(),
        awayScore: z.number().int().min(0).optional(),
        winnerTeamId: TeamIdSchema.nullable().optional(),
        kickoffAt: z.iso.datetime({ offset: true }).optional(),
        reason: z.string().min(1).max(300),
      }),
    )
    const game = await ctx.repo.findGame(ctx.params.gameId!, season.year)
    if (!game) throw new HttpError(404, 'NOT_FOUND', 'Game not found')
    const outcome = applyGameResult(game, {
      gameId: game.id,
      ...body,
      source: 'commissioner',
      observedAt: ctx.now().toISOString(),
    })
    if (outcome.changed) {
      await ctx.repo.saveGame(outcome.game, game.resultVersion)
      await audit(
        ctx,
        league.id,
        actor.playerId,
        'game.manual_result',
        `Manual result for ${game.awayTeamId} @ ${game.homeTeamId} (week ${game.week}): ${body.reason}`,
      )
    }
    return json(200, outcome.game)
  })

  router.add('POST', '/nfl/:year/weeks/:week/sync', async (ctx) => {
    const { league, actor } = await ctx.requireCommissioner(ctx.env.defaultLeagueId)
    const year = Number(ctx.params.year)
    const week = WeekNumberSchema.parse(Number(ctx.params.week))
    try {
      const r = await syncWeek(ctx, year, week)
      await audit(
        ctx,
        league.id,
        actor.playerId,
        'results.synced',
        `Week ${week} synced from ${ctx.provider.name}: ${r.changed} changed`,
      )
      return json(200, r)
    } catch (err) {
      throw new HttpError(
        503,
        'PROVIDER_UNAVAILABLE',
        `The NFL data provider (${ctx.provider.name}) is unavailable: ${err instanceof Error ? err.message : 'unknown error'}. Enter results manually.`,
      )
    }
  })
}
