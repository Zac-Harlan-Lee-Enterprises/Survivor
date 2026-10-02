import { getTeam, type PlayerStanding, type SurvivorStatus } from '@/domain'

/** Fun survival copy — dramatic, never cruel. */

export function statusHeadline(status: SurvivorStatus): string {
  switch (status) {
    case 'champion':
      return 'Champion'
    case 'co-champion':
      return 'Co-Champion'
    case 'finalist':
      return 'Tied Finalist'
    case 'alive':
      return 'Still Alive'
    case 'eliminated':
      return 'Eliminated'
    case 'inactive':
      return 'Inactive'
  }
}

export function livesLine(s: PlayerStanding): string {
  if (s.status === 'champion' || s.status === 'co-champion') return 'Last one standing.'
  if (s.status === 'eliminated') return `Went down in week ${s.eliminatedWeek}.`
  if (s.status === 'inactive') return 'Sitting this season out.'
  if (s.livesRemaining === 1) return 'On the bubble. One more miss and it’s over.'
  if (s.strikes === 0 && s.weeksSurvived >= 3) return 'Perfect season. Untouchable so far.'
  if (s.strikes === 0) return 'Still standing.'
  if (s.livesRemaining === 2) return 'Two lives left. Living dangerously.'
  return `${s.livesRemaining} lives left.`
}

export function outcomeLabel(outcome: PlayerStanding['history'][number]['outcome']): string {
  switch (outcome) {
    case 'win':
      return 'Win'
    case 'loss':
      return 'Loss'
    case 'tie':
      return 'Tie'
    case 'pending':
      return 'Pending'
    case 'void':
      return 'Void'
    case 'missing':
      return 'No pick'
    case 'not_required':
      return '—'
  }
}

export function ridingWith(teamName: string, week: number): string {
  return `You are riding with ${teamName} in week ${week}.`
}

export function streakLine(streak: number): string | null {
  if (streak >= 5) return `${streak} straight. Heater.`
  if (streak >= 3) return `${streak} in a row.`
  return null
}

type WeekResult = PlayerStanding['history'][number]

/** What cost a life that week, as it would be engraved: "the Chargers", "a missed deadline". */
function lifeTaker(h: WeekResult): string {
  if (!h.pick) return 'a missed deadline'
  const team = getTeam(h.pick.teamId)
  const name = team ? `the ${team.name}` : h.pick.teamId
  return h.outcome === 'tie' ? `${name} (a tie)` : name
}

/**
 * The line engraved on an eliminated player's headstone.
 *
 * Read straight off the engine's history: the week marked `eliminatedHere` is
 * the cause, and every earlier week that consumed a life is a complication.
 * Nothing is recomputed here — the engine already decided who died and when.
 */
export function causeOfDeath(s: PlayerStanding): string | null {
  const fatal = s.history.find((h) => h.eliminatedHere)
  if (!fatal) return null
  const complications = s.history
    .filter((h) => h.consumedLife && h.week < fatal.week)
    .map((h) => `${lifeTaker(h)} (wk ${h.week})`)
  const cause = `Died of ${lifeTaker(fatal)}, week ${fatal.week}.`
  return complications.length ? `${cause} Complications: ${complications.join(', ')}.` : cause
}
