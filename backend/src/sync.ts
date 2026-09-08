import { applyGameResults, evaluateSeason, type NFLGame } from '@domain/index'
import type { AppDeps } from './app'
import { ConditionFailed } from './lib/store'
import { toResultUpdates } from './providers'

/**
 * Result synchronisation. Safe to run as often as you like:
 *   - unchanged observations are no-ops (applyGameResults is idempotent)
 *   - commissioner-sourced results are never overwritten by the provider
 *   - writes are conditional on resultVersion, so two overlapping runs cannot
 *     double-apply or interleave (the loser simply skips)
 *   - games the provider returns for the first time (schedule load) are
 *     created; games it stops returning are left untouched
 */
export interface SyncResult {
  changed: number
  skipped: number
  created: number
}

type SyncDeps = Pick<AppDeps, 'repo' | 'provider' | 'now'>

export async function syncWeek(
  deps: SyncDeps,
  seasonYear: number,
  week: number,
): Promise<SyncResult> {
  const observedAt = deps.now().toISOString()
  const fetched = await deps.provider.fetchWeek(seasonYear, week)
  const existing = await deps.repo.listGames(seasonYear, week)
  const byId = new Map(existing.map((g) => [g.id, g]))

  let created = 0
  const known: NFLGame[] = []
  for (const g of fetched.games) {
    const cur = byId.get(g.id)
    if (cur) known.push(cur)
    else {
      // New to us: store as scheduled first, then let the result pass apply scores.
      const scheduled: NFLGame = {
        ...g,
        status: 'scheduled',
        homeScore: undefined,
        awayScore: undefined,
        winnerTeamId: undefined,
        resultVersion: 0,
        resultSource: undefined,
      }
      await deps.repo.saveGame(scheduled, null)
      known.push(scheduled)
      created += 1
    }
  }
  if (created > 0 || existing.length === 0) await deps.repo.putWeek(fetched.week)

  const batch = applyGameResults(known, toResultUpdates(fetched.games, observedAt))
  let changed = 0
  let skipped = batch.skipped.length
  for (const game of batch.changed) {
    const prev = known.find((g) => g.id === game.id)!
    try {
      await deps.repo.saveGame(game, prev.resultVersion)
      changed += 1
    } catch (err) {
      if (err instanceof ConditionFailed) skipped += 1
      else throw err
    }
  }
  return { changed, skipped, created }
}

/**
 * Scheduled entry point: syncs the current week of every active season.
 * Weeks are chosen by evaluating the season with the domain engine, so the
 * job follows the league's own notion of "current".
 */
export async function syncActiveSeasons(
  deps: SyncDeps,
): Promise<Array<{ leagueId: string; week: number; result: SyncResult | { error: string } }>> {
  const out: Array<{ leagueId: string; week: number; result: SyncResult | { error: string } }> = []
  for (const league of await deps.repo.listLeagues()) {
    const season = await deps.repo.getSeason(league.id, league.currentSeasonId)
    if (!season || season.status !== 'active') continue
    const snapshot = await deps.repo.loadSnapshot(league, season)
    const evaluation = evaluateSeason(snapshot, { now: deps.now() })
    const weeks = new Set<number>([evaluation.currentWeek])
    // Also re-check the previous week in case a late correction landed.
    if (evaluation.currentWeek > season.startWeek) weeks.add(evaluation.currentWeek - 1)
    for (const week of weeks) {
      try {
        out.push({ leagueId: league.id, week, result: await syncWeek(deps, season.year, week) })
      } catch (err) {
        out.push({
          leagueId: league.id,
          week,
          result: { error: err instanceof Error ? err.message : String(err) },
        })
      }
    }
  }
  return out
}
