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

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const TEENS = [
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
]
const TENS = ['', '', 'twenty', 'thirty']
/** Numbers as the commissioner writes them: words up to thirty-nine, digits beyond. */
const word = (n: number): string => {
  if (n < 10) return ONES[n]!
  if (n < 20) return TEENS[n - 10]!
  if (n < 40) return `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ''}`
  return String(n)
}

/** "the Chargers" — a team's name as the commissioner says it. */
const the = (teamId: string) => {
  const team = getTeam(teamId)
  return team ? `the ${team.name}` : teamId
}

/**
 * How a week's game went for the pick: "14–26 to Arizona at home" or
 * "lost on the road to Cleveland, 19–23". Scores only where the game has them.
 */
function gameLine(h: WeekResult): string {
  const pick = h.pick
  const game = h.game
  if (!pick) return 'no pick arrived, which the rules price the same as a loss'
  if (!game) return `${the(pick.teamId)}`
  const home = game.homeTeamId === pick.teamId
  const opponent = home ? game.awayTeamId : game.homeTeamId
  const where = home ? 'at home' : 'on the road'
  const mine = home ? game.homeScore : game.awayScore
  const theirs = home ? game.awayScore : game.homeScore
  const score = mine !== undefined && theirs !== undefined ? `, ${mine}–${theirs}` : ''
  if (h.outcome === 'tie')
    return `${the(pick.teamId)} tied ${getTeam(opponent)?.name ?? opponent} ${where}${score}, which costs a life all the same`
  if (h.outcome === 'win') return `${the(pick.teamId)} ${where}${score}`
  return `${the(pick.teamId)} ${where}, beaten by ${getTeam(opponent)?.name ?? opponent}${score}`
}

/**
 * An epitaph written from the record, for a grave the commissioner has not
 * yet written one for. One paragraph: how they went, week by week, in the
 * house voice — dry, factual, a little pointed. Everything in it comes from
 * the engine's history, so it is true by construction; the hand-written one
 * in src/lib/epitaphs.ts replaces it when it exists.
 */
export function autoEpitaph(name: string, s: PlayerStanding): string | null {
  const fatal = s.history.find((h) => h.eliminatedHere)
  if (!fatal) return null
  const first = name.split(' ')[0]!
  const played = s.history.filter(
    (h) => h.week <= fatal.week && (h.pick || h.outcome === 'missing'),
  )
  const losses = played.filter((h) => h.consumedLife && h.week < fatal.week)
  const wins = played.filter((h) => h.outcome === 'win')
  const parts: string[] = []

  parts.push(
    `${name} came into the season with ${word(s.livesTotal)} ${s.livesTotal === 1 ? 'life' : 'lives'} and left it in week ${fatal.week}.`,
  )
  if (wins.length) {
    const list = wins.map((h) => `${the(h.pick!.teamId)} in week ${h.week}`)
    const joined =
      list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list[0]!
    parts.push(
      `The ${wins.length === 1 ? 'win' : 'wins'} — ${joined} — ${wins.length === 1 ? 'was' : 'were'} the easy part.`,
    )
  } else if (played.length > 1) {
    parts.push(`There were no wins. Not one. Consistency is a virtue.`)
  }
  for (const h of losses) {
    parts.push(`Week ${h.week}: ${gameLine(h)}.`)
  }
  const fatalLine = fatal.pick
    ? `Then, on the last life, ${gameLine(fatal)}.`
    : `Then, on the last life, no pick arrived at all.`
  parts.push(fatalLine)

  // A closing note the record supports.
  const fatalWinner = fatal.game?.winnerTeamId
  const earlierByThem = fatalWinner
    ? losses.find((h) => h.game?.winnerTeamId === fatalWinner && h.pick)
    : undefined
  const missed = played.filter((h) => !h.pick).length
  if (earlierByThem) {
    parts.push(
      `${getTeam(fatalWinner!)?.name ?? fatalWinner} had already taken a life in week ${earlierByThem.week}; they came back to finish the job.`,
    )
  } else if (missed > 0) {
    parts.push(
      `${word(missed)[0]!.toUpperCase()}${word(missed).slice(1)} of the lives went to ${missed === 1 ? 'a missing pick' : 'missing picks'}, which is the one way to lose without watching.`,
    )
  } else if (
    losses.length &&
    losses.every((h) => h.game && h.pick && h.game.homeTeamId === h.pick.teamId) &&
    fatal.game &&
    fatal.pick &&
    fatal.game.homeTeamId === fatal.pick.teamId
  ) {
    parts.push(
      `Every one of those was a home team. ${first} believed in home-field advantage right to the end.`,
    )
  }
  parts.push(
    `Rest in peace, ${first}. ${word(s.teamsRemaining.length)[0]!.toUpperCase()}${word(s.teamsRemaining.length).slice(1)} teams go unused.`,
  )
  return parts.join(' ')
}
