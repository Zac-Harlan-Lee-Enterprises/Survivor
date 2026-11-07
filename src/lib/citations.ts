/**
 * Citations for the champion: the opposite of an epitaph. A one-paragraph
 * recap of the winner's own season, shown under them once the season is
 * decided (the league home and their profile).
 *
 * The house style is the epitaphs' (src/lib/epitaphs.ts): very factually
 * accurate, super funny, a bit edgy, every pick, score and stat real and
 * pinned by a test, and reviewed by the commissioner in a PR. Dense with
 * jokes; each one built on a checked fact.
 *
 * Keyed by player id. Until the commissioner has written theirs, a champion
 * gets a citation written from the record (`autoCitation`) — see
 * `citationFor`.
 */
import { getTeam, type PlayerStanding } from '@/domain'
import { gameLine, the, word } from './copy'

export interface Citation {
  /** One paragraph: their season, start to crown. */
  recap: string
  /** The week the season was decided — the engine must agree, or it waits. */
  writtenAfterWeek: number
}

export const CITATIONS: Record<string, Citation> = {}

const crowned = (s: PlayerStanding) => s.status === 'champion' || s.status === 'co-champion'
const cap = (t: string) => `${t[0]!.toUpperCase()}${t.slice(1)}`
const played = (h: PlayerStanding['history'][number]) =>
  !!h.pick && (h.outcome === 'win' || h.outcome === 'loss' || h.outcome === 'tie')

/**
 * The citation a champion is shown with: the commissioner's own words when he
 * has written them for the week the season was actually decided, the
 * record's otherwise. Nothing for anyone not wearing the crown.
 */
export function citationFor(
  playerId: string,
  displayName: string,
  standing: PlayerStanding,
  everyone: readonly PlayerStanding[],
  decidedWeek: number | null,
): string | null {
  if (!crowned(standing)) return null
  const written = CITATIONS[playerId]
  if (written && written.writtenAfterWeek === decidedWeek) return written.recap
  return autoCitation(displayName, standing, everyone)
}

/**
 * A citation written from the record, for a champion the commissioner has
 * not yet found the words for. Everything in it is read off the engine's
 * history, so it is true by construction: how many they outlasted, the
 * record, the closest call, the week they went alone, the crowd they
 * stepped round, and the lives it cost.
 */
export function autoCitation(
  name: string,
  s: PlayerStanding,
  everyone: readonly PlayerStanding[],
): string {
  const first = name.split(' ')[0]!
  const others = everyone.filter((o) => o.playerId !== s.playerId && o.status !== 'inactive')
  const partners = others.filter(crowned)
  const beaten = others.length - partners.length
  const weeks = s.history.filter(played)
  const wins = weeks.filter((h) => h.outcome === 'win')
  const parts: string[] = []

  /** Who else picked `teamId` in `week`. */
  const company = (week: number, teamId: string) =>
    others.filter((o) => o.history.some((h) => h.week === week && h.pick?.teamId === teamId))

  // Who they outlasted.
  if (partners.length) {
    const names = partners.length === 1 ? 'one other' : `${word(partners.length)} others`
    parts.push(
      `${name} outlasted ${word(beaten)} of us and shares the crown with ${names}, which is the most polite way a survivor league can end.`,
    )
  } else {
    parts.push(`${name} outlasted ${word(beaten)} of us. Every single one.`)
  }

  // The record.
  if (weeks.length) {
    const lives =
      s.livesRemaining === s.livesTotal
        ? 'and never lost a life, which is frankly showing off'
        : `and finished with ${word(s.livesRemaining)} of ${word(s.livesTotal)} ${s.livesTotal === 1 ? 'life' : 'lives'}`
    parts.push(
      `${cap(word(wins.length))} ${wins.length === 1 ? 'win' : 'wins'} in ${word(weeks.length)} ${weeks.length === 1 ? 'week' : 'weeks'}, ${lives}.`,
    )
  }

  // The closest call: the tightest win on the scoreboard.
  const margin = (h: PlayerStanding['history'][number]) => {
    const g = h.game
    if (!g || g.homeScore === undefined || g.awayScore === undefined) return Infinity
    return Math.abs(g.homeScore - g.awayScore)
  }
  const tightest = wins.reduce<(typeof wins)[number] | null>(
    (best, h) => (margin(h) < (best ? margin(best) : Infinity) ? h : best),
    null,
  )
  if (tightest && margin(tightest) <= 3) {
    parts.push(
      `The closest call was week ${tightest.week}: ${gameLine(tightest)}. ${margin(tightest) === 1 ? 'One point.' : `${cap(word(margin(tightest)))} points.`} Nobody breathed.`,
    )
  }

  // The week they went alone and were right.
  const alone = wins.find((h) => company(h.week, h.pick!.teamId).length === 0)
  if (alone && others.length > 1) {
    parts.push(
      `In week ${alone.week} ${first} was the only one of us on ${the(alone.pick!.teamId)}, and ${the(alone.pick!.teamId)} won.`,
    )
  }

  // The biggest crowd that went down while they stood aside.
  let dodged: { week: number; teamId: string; size: number } | null = null
  for (const h of weeks) {
    const losers = new Map<string, number>()
    for (const o of others) {
      const theirs = o.history.find((x) => x.week === h.week)
      if (!theirs?.pick || !theirs.consumedLife) continue
      if (theirs.pick.teamId === h.pick!.teamId) continue
      losers.set(theirs.pick.teamId, (losers.get(theirs.pick.teamId) ?? 0) + 1)
    }
    for (const [teamId, size] of losers)
      if (size >= 3 && (!dodged || size > dodged.size)) dodged = { week: h.week, teamId, size }
  }
  if (dodged) {
    const mine = weeks.find((h) => h.week === dodged.week)!
    parts.push(
      `In week ${dodged.week}, ${word(dodged.size)} of us lost a life on ${the(dodged.teamId)}; ${first} was over on ${the(mine.pick!.teamId)}, not looking.`,
    )
  }

  // What it cost.
  const scars = s.history.filter((h) => h.consumedLife)
  if (scars.length) {
    const list = scars.map((h) =>
      h.pick
        ? `${getTeam(h.pick.teamId)?.name ?? h.pick.teamId} in week ${h.week}`
        : `a missed pick in week ${h.week}`,
    )
    const joined =
      list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list[0]!
    parts.push(`The scars: ${joined}. ${first} kept walking.`)
  }

  parts.push(partners.length ? `Long live the co-champions.` : `Long live ${first}.`)
  return parts.join(' ')
}
