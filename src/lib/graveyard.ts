import { weekSummary, type PlayerStanding, type SeasonEvaluation } from '@/domain'

/**
 * The week whose dead get a funeral: the week being played. From Thursday's
 * lock through Monday night that is the current week; once its games are over
 * and the next week opens for picks, it stays on stage until that next week
 * locks, so the review goes up beside its funerals.
 */
export function funeralWeek(evaluation: SeasonEvaluation): number {
  const now = weekSummary(evaluation, evaluation.currentWeek)
  return now?.phase === 'open' ? evaluation.currentWeek - 1 : evaluation.currentWeek
}

/**
 * Splits the fallen for the league page's graveyard.
 *
 * Fresh graves are this week's dead, every one of them, each with its own
 * funeral however many die at once. Everyone who died in an earlier week is
 * an old grave: a plain headstone, no scene. Standings arrive with the most
 * recently eliminated first, and both lists keep that order.
 */
export function graveyardPreview(evaluation: SeasonEvaluation): {
  fresh: PlayerStanding[]
  old: PlayerStanding[]
} {
  const week = funeralWeek(evaluation)
  const fallen = evaluation.standings.filter((s) => s.status === 'eliminated')
  return {
    fresh: fallen.filter((s) => s.eliminatedWeek === week),
    old: fallen.filter((s) => s.eliminatedWeek !== week),
  }
}
