/**
 * Citations for the champion: the opposite of an epitaph. A one-paragraph
 * recap of the winner's own season, shown under them once the season is
 * decided (the league home and their profile).
 *
 * The register is a royal proclamation, funny and way over the top (the
 * commissioner's call): a coronation, not a recap. Underneath the trumpets
 * the epitaphs' rules hold (src/lib/epitaphs.ts): every pick, score and
 * stat real and pinned by a test, dense with jokes, each one built on a
 * checked fact, reviewed by the commissioner in a PR.
 *
 * Keyed by player id. Until the commissioner has written theirs, a champion
 * gets a citation written from the record (`autoCitation`) — see
 * `citationFor`.
 */
import type { PlayerStanding } from '@/domain'
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
  league?: string,
): string | null {
  if (!crowned(standing)) return null
  const written = CITATIONS[playerId]
  if (written && written.writtenAfterWeek === decidedWeek) return written.recap
  return autoCitation(displayName, standing, everyone, league)
}

const list = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items[0]!

/**
 * A citation written from the record, for a champion the commissioner has
 * not yet found the words for: a proclamation. Everything it claims is read
 * off the engine's history, so it is true by construction: how many they
 * outlasted and buried, the record, every team they rode, the closest call,
 * the week they went alone, the stampede they stepped round, and the lives
 * it cost. The trumpets are free.
 */
export function autoCitation(
  name: string,
  s: PlayerStanding,
  everyone: readonly PlayerStanding[],
  league = 'this league',
): string {
  const first = name.split(' ')[0]!
  const others = everyone.filter((o) => o.playerId !== s.playerId && o.status !== 'inactive')
  const partners = others.filter(crowned)
  const beaten = others.filter((o) => !crowned(o))
  const graves = beaten.filter((o) => o.status === 'eliminated').length
  const weeks = s.history.filter(played)
  const wins = weeks.filter((h) => h.outcome === 'win')
  const rode = s.history.filter((h) => h.pick && h.outcome !== 'void')
  const parts: string[] = []

  /** Who else picked `teamId` in `week`. */
  const company = (week: number, teamId: string) =>
    others.filter((o) => o.history.some((h) => h.week === week && h.pick?.teamId === teamId))

  parts.push(
    `Hear ye, hear ye. Let it be known in every group chat, sports bar and Thanksgiving argument from now until the end of time: ${name} is the champion of ${league}.`,
  )

  // Who they outlasted, and who among them.
  const commissioner = beaten.some((o) => o.membership.role === 'commissioner')
  const bearsFan = beaten.some((o) => o.playerId === 'joseph-tomczuk')
  const among = [
    commissioner ? 'the commissioner' : null,
    bearsFan ? 'at least one Bears fan (hi, Joey)' : null,
  ].filter((x): x is string => !!x)
  const including = among.length ? `, ${list(among)} among them,` : ''
  if (partners.length) {
    parts.push(
      `${first} outlasted ${word(beaten.length)} of us${including} and then agreed to share the crown with ${partners.length === 1 ? 'one other survivor' : `${word(partners.length)} other survivors`}, which in a survivor league is the sporting equivalent of a sudden-death overtime that ends in a group hug.`,
    )
  } else {
    parts.push(
      `${first} outlasted ${word(beaten.length)} of us${including} and left every single one of them standing in the rain.`,
    )
  }
  if (graves > 0) {
    parts.push(
      `The graveyard holds ${word(graves)} ${graves === 1 ? 'headstone' : 'headstones'}, and ${first} walked past every one of them without slowing down.`,
    )
  }

  // The record.
  if (weeks.length) {
    const record = `${cap(word(wins.length))} ${wins.length === 1 ? 'win' : 'wins'} in ${word(weeks.length)} ${weeks.length === 1 ? 'week' : 'weeks'}`
    parts.push(
      s.livesRemaining === s.livesTotal
        ? `${record} without losing a single life, which is not a strategy. It is witchcraft.`
        : `${record}, finishing on ${word(s.livesRemaining)} of ${word(s.livesTotal)} ${s.livesTotal === 1 ? 'life' : 'lives'}: bloodied, limping and completely unbothered.`,
    )
  }

  // Every team they rode.
  if (rode.length >= 3) {
    const teams = rode.map((h) => the(h.pick!.teamId))
    parts.push(
      `The road to glory ran through ${list(teams)}: ${word(teams.length)} franchises who will never know they were part of something historic.`,
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
    const by = margin(tightest) === 1 ? 'One point.' : `${cap(word(margin(tightest)))} points.`
    parts.push(
      `The closest call was week ${tightest.week}: ${gameLine(tightest)}. ${by} Somewhere, a cardiologist bought a boat.`,
    )
  }

  // The week they went alone and were right.
  const alone = wins.find((h) => company(h.week, h.pick!.teamId).length === 0)
  if (alone && others.length > 1) {
    const team = the(alone.pick!.teamId)
    parts.push(
      `In week ${alone.week} ${first} took ${team} when not one other person in the league would touch them. ${cap(team)} won. The rest of us have been quietly furious about it ever since.`,
    )
  }

  // The biggest stampede that went off a cliff while they stood aside.
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
      `In week ${dodged.week}, ${word(dodged.size)} of us stampeded onto ${the(dodged.teamId)} and lost a life together, like lemmings in matching jerseys; ${first} was over on ${the(mine.pick!.teamId)}, not even looking.`,
    )
  }

  // What it cost.
  const scars = s.history.filter((h) => h.consumedLife)
  if (scars.length) {
    const takers = scars.map((h) =>
      h.pick
        ? `${the(h.pick.teamId)} in week ${h.week}`
        : `a pick that never arrived in week ${h.week}`,
    )
    parts.push(
      `${cap(list(takers))} ${scars.length === 1 ? 'took a life' : 'each took a life'}. ${first} has forgiven them. ${first} has not forgotten.`,
    )
  }

  parts.push(
    partners.length
      ? `All hail the co-champions. May they never have to pick against each other again.`
      : `Statues will be commissioned. Ballads will be written. Children will be named ${first}. All hail ${first}: Last One Standing, Breaker of Spirits, First of Their Name.`,
  )
  return parts.join(' ')
}
