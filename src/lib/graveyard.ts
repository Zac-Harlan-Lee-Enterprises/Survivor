import type { PlayerStanding } from '@/domain'

/** Older graves the league page shows: one compact row. The full graveyard is on the leaderboard. */
export const OLD_GRAVES_SHOWN = 6

/**
 * Splits the fallen for the league page's graveyard preview.
 *
 * Fresh graves are everyone who went out last week or this one, and every one
 * of them is shown: each gets their own funeral, however many die at once.
 * Older graves fill one compact row after them. Standings arrive with the
 * most recently eliminated first, so the row keeps the newest of the old.
 */
export function graveyardPreview(
  standings: readonly PlayerStanding[],
  currentWeek: number,
): { fresh: PlayerStanding[]; old: PlayerStanding[] } {
  const fallen = standings.filter((s) => s.status === 'eliminated')
  const isFresh = (s: PlayerStanding) =>
    s.eliminatedWeek !== null && s.eliminatedWeek >= currentWeek - 1
  return {
    fresh: fallen.filter(isFresh),
    old: fallen.filter((s) => !isFresh(s)).slice(0, OLD_GRAVES_SHOWN),
  }
}
