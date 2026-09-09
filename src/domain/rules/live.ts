import type { NFLGame } from '../models'
import { toDate } from '../time'

/**
 * When a week is worth polling, and what moved on the scoreboard.
 *
 * Pure and clock-free on purpose: `now` is an argument, so the polling decision
 * is a plain function of the schedule and can be tested without fake timers.
 */

/**
 * How long before kickoff to start watching.
 *
 * The provider flips a game to in-progress at kickoff, so a poll that only
 * started once something was already live would never start at all — the
 * status it waits for is the status the poll exists to fetch. Arming slightly
 * early breaks that circle.
 */
export const LIVE_LEAD_MINUTES = 2

/** A game that has started (or is about to) and has not been decided. */
function isLive(game: NFLGame, now: Date, leadMinutes: number): boolean {
  if (game.status === 'final' || game.status === 'cancelled' || game.status === 'postponed') {
    return false
  }
  const startsWatching = toDate(game.kickoffAt).getTime() - leadMinutes * 60_000
  return now.getTime() >= startsWatching
}

/**
 * Whether any game in this set is underway, and so whether live scores are
 * worth fetching. Decided from kickoff times rather than stored status: the
 * stored status is what the fetch is for.
 */
export function weekIsLive(
  games: NFLGame[],
  now: Date | string,
  leadMinutes = LIVE_LEAD_MINUTES,
): boolean {
  const at = toDate(now)
  return games.some((g) => isLive(g, at, leadMinutes))
}

export interface ScoreLine {
  homeScore?: number
  awayScore?: number
}

export interface ScoreChange {
  home: boolean
  away: boolean
}

/**
 * Which side of a game just scored.
 *
 * A side counts as changed only when it held a number before and holds a
 * different one now. A first reading is not a change — otherwise every tile
 * would flash on load, which says nothing.
 */
export function changedScores(
  previous: ScoreLine | undefined,
  next: ScoreLine | undefined,
): ScoreChange {
  const moved = (before: number | undefined, after: number | undefined) =>
    before !== undefined && after !== undefined && before !== after
  return {
    home: moved(previous?.homeScore, next?.homeScore),
    away: moved(previous?.awayScore, next?.awayScore),
  }
}
