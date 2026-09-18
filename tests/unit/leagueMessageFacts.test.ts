import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

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
 * Read from disk rather than imported, like cropNudges.test.ts next door:
 * tests/unit is compiled by tsconfig.node.json, which does not include src.
 */
interface Pick {
  playerId: string
  week: number
  teamId: string
  gameId: string
}
interface Game {
  id: string
  week: number
  homeTeamId: string
  awayTeamId: string
  kickoffAt: string
}
interface Season {
  picks: Pick[]
  games: Game[]
  profiles: { playerId: string; displayName: string }[]
  memberships: { playerId: string; role: string }[]
}

const season = JSON.parse(
  readFileSync(new URL('../../src/data/demo/fixtures/demo-season.json', import.meta.url), 'utf8'),
) as Season

const WEEK = 2
const picks = season.picks.filter((p) => p.week === WEEK)
const gamesById = new Map(season.games.map((g) => [g.id, g]))
const countOn = (teamId: string) => picks.filter((p) => p.teamId === teamId).length
const nameOf = (playerId: string) =>
  season.profiles.find((p) => p.playerId === playerId)?.displayName ?? playerId
const pickBy = (displayName: string) => picks.find((p) => nameOf(p.playerId) === displayName) ?? null
const week1TeamOf = (displayName: string) =>
  season.picks.find((p) => p.week === 1 && nameOf(p.playerId) === displayName)?.teamId ?? null

describe('the commissioner’s week 2 note states only true things', () => {
  it('“Week 2 has no byes. All thirty-two teams are available”', () => {
    const playing = new Set(
      season.games.filter((g) => g.week === WEEK).flatMap((g) => [g.homeTeamId, g.awayTeamId]),
    )
    expect(playing.size).toBe(32)
  })

  it('“Twelve of you … ordered San Francisco”', () => {
    expect(countOn('SF')).toBe(12)
  })

  it('“Eight of you are on Tampa Bay. Tony is on Cleveland” — and it is one game', () => {
    expect(countOn('TB')).toBe(8)
    const tony = pickBy('Tony Canody')
    expect(tony?.teamId).toBe('CLE')
    // The joke only works if they are in the same fixture, on opposite sides.
    const tb = picks.find((p) => p.teamId === 'TB')
    expect(tony?.gameId).toBe(tb?.gameId)
    const game = gamesById.get(tony?.gameId ?? '')
    expect([game?.homeTeamId, game?.awayTeamId].sort()).toEqual(['CLE', 'TB'])
    // "Nine of you are in the same football game on opposite sides."
    expect(picks.filter((p) => p.gameId === tony?.gameId)).toHaveLength(9)
  })

  it('“Joanna, Allison and Phyllis are on Buffalo”, decided Thursday', () => {
    const buf = picks
      .filter((p) => p.teamId === 'BUF')
      .map((p) => nameOf(p.playerId))
      .sort()
    expect(buf).toEqual(['Allison Petty', 'Joanna Moss', 'Phyllis Collins'])
    // "before most of you have finished dinner": the week's first kickoff.
    const earliest = season.games
      .filter((g) => g.week === WEEK)
      .map((g) => g.kickoffAt)
      .sort()[0]
    const bufGame = gamesById.get(picks.find((p) => p.teamId === 'BUF')!.gameId)
    expect(bufGame?.kickoffAt).toBe(earliest)
  })

  it('“Allison’s week 1 pick was Detroit” — and Detroit are her week 2 opponent', () => {
    expect(week1TeamOf('Allison Petty')).toBe('DET')
    const game = gamesById.get(pickBy('Allison Petty')!.gameId)
    expect([game?.homeTeamId, game?.awayTeamId]).toContain('DET')
  })

  it('“Twenty-seven of the twenty-nine picks … on home teams”, exceptions Melanie and Tony', () => {
    expect(picks).toHaveLength(29)
    const away = picks.filter((p) => gamesById.get(p.gameId)?.awayTeamId === p.teamId)
    expect(away.map((p) => nameOf(p.playerId)).sort()).toEqual(['Melanie Moeller', 'Tony Canody'])
    expect(picks.length - away.length).toBe(27)
  })

  it('“Melanie … has Philadelphia at Tennessee”', () => {
    const melanie = pickBy('Melanie Moeller')
    expect(melanie?.teamId).toBe('PHI')
    expect(gamesById.get(melanie?.gameId ?? '')?.homeTeamId).toBe('TEN')
  })

  it('“Joanna and Matt … the Cowboys and the Packers”, both now back with the crowd', () => {
    expect(week1TeamOf('Joanna Moss')).toBe('DAL')
    expect(week1TeamOf('Matt Hadley')).toBe('GB')
    expect(pickBy('Joanna Moss')?.teamId).toBe('BUF')
    expect(pickBy('Matt Hadley')?.teamId).toBe('SF')
  })

  it('“Jacksonville gone for seven … Detroit and the Chargers for six apiece, Seattle for four”', () => {
    const week1 = season.picks.filter((p) => p.week === 1)
    const used = (teamId: string) => week1.filter((p) => p.teamId === teamId).length
    expect(used('JAX')).toBe(7)
    expect(used('DET')).toBe(6)
    expect(used('LAC')).toBe(6)
    expect(used('SEA')).toBe(4)
  })

  it('“Bradley has now burned Detroit and Chicago in consecutive weeks”', () => {
    expect(week1TeamOf('Bradley Riedell')).toBe('DET')
    expect(pickBy('Bradley Riedell')?.teamId).toBe('CHI')
  })

  it('“your commissioner … joined the San Francisco pile”, having had the Chargers', () => {
    const commissioner = season.memberships.find((m) => m.role === 'commissioner')
    const name = nameOf(commissioner?.playerId ?? '')
    expect(week1TeamOf(name)).toBe('LAC')
    expect(pickBy(name)?.teamId).toBe('SF')
  })

  it('“All twenty-nine picks are in … nobody missed”', () => {
    const answered = new Set(picks.map((p) => p.playerId))
    const silent = season.profiles.filter((p) => !answered.has(p.playerId))
    expect(silent).toEqual([])
    expect(answered.size).toBe(season.profiles.length)
  })

  it('“they locked at 7:10 PM Thursday, five minutes before Detroit at Buffalo”', () => {
    const [opener] = season.games
      .filter((g) => g.week === WEEK)
      .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))
    if (!opener) throw new Error(`week ${WEEK} has no games`)
    expect([opener.awayTeamId, opener.homeTeamId]).toEqual(['DET', 'BUF'])
    const lock = new Date(new Date(opener.kickoffAt).getTime() - 5 * 60_000)
    const shown = lock.toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      weekday: 'long',
      hour: 'numeric',
      minute: '2-digit',
    })
    expect(shown).toContain('Thursday')
    expect(shown).toContain('7:10')
  })
})
