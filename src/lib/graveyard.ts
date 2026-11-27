import { weekSummary, type PlayerStanding, type SeasonEvaluation } from '@/domain'

/**
 * The week on stage: the week being played. Its dead are the fresh graves, and
 * what happened in it decides what Death does when he comes. From Thursday's
 * lock through Monday night that is the current week; once its games are over
 * and the next week opens for picks, it stays on stage until that next week
 * locks, so the review goes up beside its funerals.
 */
export function funeralWeek(evaluation: SeasonEvaluation): number {
  const now = weekSummary(evaluation, evaluation.currentWeek)
  // A week not yet under way (open for picks, or its schedule not loaded) leaves
  // the week before it on stage.
  const notStarted = !now || now.phase === 'open' || now.phase === 'no-data'
  return notStarted && evaluation.currentWeek > 1
    ? evaluation.currentWeek - 1
    : evaluation.currentWeek
}

/**
 * Splits the fallen for the league page's graveyard.
 *
 * Fresh graves are this week's dead, every one of them; everyone who died in
 * an earlier week is an old grave. A week with fresh graves, only they play
 * a funeral and the old ones are plain stones under them; a week without,
 * every grave plays its funeral when it is scrolled to (the commissioner's
 * decisions, 2026-11-25 and 26: weeks without a death had left the graveyard
 * a row of bare stones, but the new dead do not share their week). Standings arrive with the most recently
 * eliminated first, and both lists keep that order.
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

/** What Death does when he stops to look at you. */
export type DeathAct = 'watch' | 'dance'

/**
 * Death's act for the week on stage. A week in which nobody lost a life bores
 * him: he takes out his pocket watch. The week somebody loses one (a miss or
 * a missing pick, eliminated or not) he puts on the straw boater and dances.
 * Read from the engine's own account of each player's week, never recounted.
 */
export function deathAct(evaluation: SeasonEvaluation): DeathAct {
  const week = funeralWeek(evaluation)
  const lifeLost = evaluation.standings.some((s) =>
    s.history.some((h) => h.week === week && h.consumedLife),
  )
  return lifeLost ? 'dance' : 'watch'
}
