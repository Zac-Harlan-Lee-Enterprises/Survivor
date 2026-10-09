import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  FINALS,
  gamesById,
  livesAfter,
  nameOf,
  pickOf,
  picksIn,
  record,
  season,
} from './seasonFacts'

/**
 * The commissioner's note states numbers about the league, and the league is
 * read by the people those numbers are about. A stat that has quietly gone
 * stale — one more pick arrives and "eleven of you" becomes twelve — is worse
 * than no stat, because it is the kind of wrong nobody checks until someone is
 * annoyed about their own name.
 *
 * So every counted claim in the current note is asserted here against the
 * season it describes. When these fail, the note needs rewriting: that is the
 * signal working, not a broken test.
 *
 * The season and its pinned finals live in ./seasonFacts, shared with the
 * headstones' epitaph test.
 */
const WEEK = 5
const picks = picksIn(WEEK)
const lives = livesAfter(WEEK - 1)
const onLastLife = (displayName: string) => lives.get(displayName) === 1
const whoOn = (teamId: string) =>
  picks
    .filter((p) => p.teamId === teamId)
    .map((p) => nameOf(p.playerId).split(' ')[0]!)
    .sort()
const gameOf = (teamId: string) => gamesById.get(picks.find((p) => p.teamId === teamId)!.gameId)!

const note = readFileSync(
  new URL('../../src/features/league-home/LeagueMessage.tsx', import.meta.url),
  'utf8',
)
const body = note.slice(note.indexOf('const WEEK_5_KICKOFF'), note.indexOf('const NOTES'))

describe('the week 5 kickoff note states only true things', () => {
  it('is a kickoff note: two paragraphs, and no callout now that picks are locked', () => {
    expect([...body.matchAll(/^ {4}'/gm)]).toHaveLength(2)
    expect(body).not.toMatch(/^\s*callout:/m)
  })

  it('“twenty-one of you are on Dallas … twenty-one of twenty-nine … 2–2, at home to … Tampa Bay … 0–4”', () => {
    expect(picks).toHaveLength(29)
    expect(whoOn('DAL')).toHaveLength(21)
    const g = gameOf('DAL')
    expect([g.awayTeamId, g.homeTeamId]).toEqual(['TB', 'DAL'])
    expect(record('DAL')).toBe('2-2')
    expect(record('TB')).toBe('0-4')
    const kickoff = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      weekday: 'long',
    })
    expect(kickoff.format(new Date(g.kickoffAt))).toBe('Thursday')
  })

  it('“Craig, Jared, Joey, Nate and Phyllis are all on their last life and all on Dallas”', () => {
    const dallasOnOne = picks
      .filter((p) => p.teamId === 'DAL' && onLastLife(nameOf(p.playerId)))
      .map((p) => nameOf(p.playerId).split(' ')[0]!)
      .sort()
    expect(dallasOnOne).toEqual(['Craig', 'Jared', 'Joseph', 'Nate', 'Phyllis'])
  })

  it('“Joey … Eagles, Vikings and Cowboys in successive weeks … not one of them the Bears”', () => {
    expect([3, 4, 5].map((w) => pickOf('Joseph Tomczuk', w)?.teamId)).toEqual(['PHI', 'MIN', 'DAL'])
  })

  it('“The other eight of you saw twenty-one people climbing onto the Cowboys bandwagon … Cincinnati at a Miami team … thirteen or fewer in every game”', () => {
    const elsewhere = picks.filter((p) => p.teamId !== 'DAL')
    expect(elsewhere).toHaveLength(8)
    expect(picks.filter((p) => p.teamId === 'DAL')).toHaveLength(21)
    expect(body).not.toMatch(/chosen violence/)
    expect(whoOn('CIN')).toEqual(['Allison', 'Cindy', 'Dave', 'Melanie'])
    const g = gameOf('CIN')
    expect([g.awayTeamId, g.homeTeamId]).toEqual(['CIN', 'MIA'])
    const miami = Object.entries(FINALS)
      .filter(([id]) => id.includes('MIA'))
      .map(([id, [away, home]]) => (gamesById.get(id)?.awayTeamId === 'MIA' ? away : home))
    expect(miami).toHaveLength(4)
    expect(miami.every((pts) => pts <= 13)).toBe(true)
  })

  it('“Joanna and Corey took Houston at Tennessee … 0–4 … visiting an 0–4 … Corey, on his last life”', () => {
    expect(whoOn('HOU')).toEqual(['Corey', 'Joanna'])
    const g = gameOf('HOU')
    expect([g.awayTeamId, g.homeTeamId]).toEqual(['HOU', 'TEN'])
    expect(record('HOU')).toBe('0-4')
    expect(record('TEN')).toBe('0-4')
    expect(onLastLife('Corey Cowell')).toBe(true)
  })

  it('“Paul has Washington, 1–3, at home to the 3–1 Giants … Tina, also on her last life, has taken New England” (at home to the 3–1 Raiders)', () => {
    expect(whoOn('WAS')).toEqual(['Paul'])
    expect(gameOf('WAS').homeTeamId).toBe('WAS')
    expect(gameOf('WAS').awayTeamId).toBe('NYG')
    expect(record('WAS')).toBe('1-3')
    expect(record('NYG')).toBe('3-1')
    expect(whoOn('NE')).toEqual(['Tina'])
    expect(gameOf('NE').homeTeamId).toBe('NE')
    expect(gameOf('NE').awayTeamId).toBe('LV')
    expect(record('NE')).toBe('2-2')
    expect(record('LV')).toBe('3-1')
    expect(onLastLife('Tina Bush')).toBe(true)
  })

  it('“Tina … has taken New England — the team that knocked her Bills off last week”', () => {
    expect(pickOf('Tina Bush', WEEK)?.teamId).toBe('NE')
    expect(pickOf('Tina Bush', WEEK - 1)?.teamId).toBe('BUF')
    expect(FINALS['2026-w04-NE-at-BUF']).toEqual([29, 26])
  })

  it('“Nobody has a stake in London or on Monday night”', () => {
    const week5 = season.games.filter((g) => g.week === WEEK)
    const london = week5.find((g) => g.awayTeamId === 'PHI' && g.homeTeamId === 'JAX')!
    const monday = [...week5].sort((a, b) => b.kickoffAt.localeCompare(a.kickoffAt))[0]!
    expect([monday.awayTeamId, monday.homeTeamId]).toEqual(['BUF', 'LAR'])
    for (const g of [london, monday]) {
      expect(
        picks.filter((p) => p.gameId === g.id),
        g.id,
      ).toHaveLength(0)
    }
  })

  it('“all twenty-nine picks arrived before the lock, the last of them at 5:41 — thank you, James”', () => {
    const opener = season.games
      .filter((g) => g.week === WEEK)
      .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))[0]!
    const lock = new Date(opener.kickoffAt).getTime() - 5 * 60_000
    expect(picks.every((p) => new Date(p.submittedAt).getTime() < lock)).toBe(true)
    // James's is the last that arrived in a message; KC's was relayed by the commissioner.
    const james = pickOf('James Parker', WEEK)!
    const at = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(james.submittedAt))
    expect(at).toBe('5:41 PM')
  })
})
