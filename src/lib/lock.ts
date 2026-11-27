import { weekSummary, type SeasonEvaluation } from '@/domain'

/** Timers further out than this are left to the page's ordinary clock tick. */
const HORIZON_MS = 60 * 60_000

/**
 * Milliseconds until the current week's picks lock, when that is near enough to
 * set a timer for (within the hour); otherwise null.
 *
 * The page re-evaluates the season on a 30-second tick, which on its own leaves
 * "Make my pick" on screen for up to a minute after the lock. One timer aimed at
 * the deadline itself closes that gap.
 */
export function msUntilLock(evaluation: SeasonEvaluation, now: Date): number | null {
  const week = weekSummary(evaluation, evaluation.currentWeek)
  if (week?.phase !== 'open' || !week.deadlineAt) return null
  const ms = new Date(week.deadlineAt).getTime() - now.getTime()
  return ms <= HORIZON_MS ? Math.max(0, ms) : null
}
