import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BOX,
  FINALS,
  SCORING,
  crowd,
  eliminatedWeekOf,
  gamesById,
  livesAfter,
  lost,
  nameOf,
  pickOf,
  picksIn,
  record,
  season,
  winnerOf,
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
const WEEK = 6
const picks = picksIn(WEEK)
const before = livesAfter(WEEK - 1)
const after = livesAfter(WEEK)
const firstNames = (names: string[]) => names.map((n) => n.split(' ')[0]!).sort()
const whoOn = (teamId: string) =>
  firstNames(picks.filter((p) => p.teamId === teamId).map((p) => nameOf(p.playerId)))
const onLives = (n: number) =>
  firstNames([...after.entries()].filter(([, l]) => l === n).map(([name]) => name))
const outIn = (week: number) =>
  season.profiles
    .filter((p) => eliminatedWeekOf(p.playerId, week) === week)
    .map((p) => p.displayName)
const plays = (gameId: string) => SCORING[gameId]!
const at = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))

/** A line from the week 5 review, kept for the callback above it in this one. */
const WEEK_5_REVIEW_SAID =
  'Craig, Jared, Joey, Nate and Phyllis are out. With Don, that is six graves, and the graveyard on this page now has more going on than the Tennessee offense.'

/** Every life lost, in order: the week, and the team that cost it (null: no pick). */
const livesLost = (() => {
  const out: { week: number; teamId: string | null }[] = []
  const lives = new Map(season.profiles.map((p) => [p.playerId, 3]))
  for (let week = 1; week <= WEEK; week++) {
    for (const p of season.profiles) {
      if (lives.get(p.playerId)! <= 0) continue
      const pick = season.picks.find((x) => x.playerId === p.playerId && x.week === week)
      if (!pick || lost(pick)) {
        lives.set(p.playerId, lives.get(p.playerId)! - 1)
        out.push({ week, teamId: pick?.teamId ?? null })
      }
    }
  }
  return out
})()
const box = (gameId: string) => BOX[gameId]!

const note = readFileSync(
  new URL('../../src/features/league-home/LeagueMessage.tsx', import.meta.url),
  'utf8',
)
const body = note.slice(note.indexOf('const WEEK_6_REVIEW'), note.indexOf('const NOTES'))

describe('the week 6 review gives away nothing about week 7', () => {
  it('mentions week 7 picks only to ask for them', () => {
    expect(body.match(/week 7 pick/gi) ?? []).toHaveLength(1)
    expect(body).toMatch(/DM me your week 7 pick on Teams/)
    expect(picksIn(7)).toHaveLength(0)
  })
})

describe('the commissioner’s week 6 review states only true things', () => {
  it('“Thirteen of you took the Rams at home to Arizona: a 2–3 team against a 1–4 team that had lost four straight”', () => {
    expect(whoOn('LAR')).toHaveLength(13)
    expect(gamesById.get('2026-w06-ARI-at-LAR')!.homeTeamId).toBe('LAR')
    expect(record('LAR', 5)).toBe('2-3')
    expect(record('ARI', 5)).toBe('1-4')
    const arizona = season.games
      .filter((g) => g.week >= 2 && g.week <= 5 && [g.homeTeamId, g.awayTeamId].includes('ARI'))
      .map((g) => g.id)
    expect(arizona).toHaveLength(4)
    expect(arizona.every((id) => winnerOf(id) !== 'ARI')).toBe(true)
  })

  it('“Arizona won 18–16 without scoring a touchdown. Chad Ryland kicked six field goals … the Rams went ahead 16–15 with forty-seven seconds left … the sixth as the clock hit zero”', () => {
    expect(FINALS['2026-w06-ARI-at-LAR']).toEqual([18, 16])
    const arizona = plays('2026-w06-ARI-at-LAR').filter(([, , team]) => team === 'ARI')
    expect(arizona).toHaveLength(6)
    expect(arizona.every(([, , , , text]) => /^Chad Ryland \d+ Yd Field Goal$/.test(text))).toBe(
      true,
    )
    const lead = plays('2026-w06-ARI-at-LAR').find(([, , , score]) => score.join() === '15,16')!
    expect(lead.slice(0, 3)).toEqual([4, '0:47', 'LAR'])
    const last = plays('2026-w06-ARI-at-LAR').at(-1)!
    expect(last.slice(0, 4)).toEqual([4, '0:00', 'ARI', [18, 16]])
  })

  it('“All thirteen of you lost a life, and nine of you lost your last one. One of the nine is writing this.”', () => {
    const rams = picks.filter((p) => p.teamId === 'LAR')
    expect(rams.every(lost)).toBe(true)
    const buried = rams.filter((p) => eliminatedWeekOf(p.playerId, WEEK) === WEEK)
    expect(buried).toHaveLength(9)
    expect(buried.map((p) => p.playerId)).toContain('zac-harlan')
    expect(season.memberships.find((m) => m.playerId === 'zac-harlan')?.role).toBe('commissioner')
  })

  it('“Five of you took Indianapolis at home to Tennessee — 0–5 … the Colts led 13–0 at halftime … a blocked punt … a man named Joey, four field goals, the last two in the final 2:03 … 26–20 … Tennessee’s first win”', () => {
    expect(whoOn('IND')).toHaveLength(5)
    expect(gamesById.get('2026-w06-TEN-at-IND')!.homeTeamId).toBe('IND')
    expect(record('TEN', 5)).toBe('0-5')
    expect(FINALS['2026-w06-TEN-at-IND']).toEqual([26, 20])
    const tvi = plays('2026-w06-TEN-at-IND')
    const half = tvi.filter(([q]) => q <= 2).at(-1)!
    expect(half[3]).toEqual([0, 13])
    expect(
      tvi.some(([, , team, , text]) => team === 'TEN' && /return of blocked punt/.test(text)),
    ).toBe(true)
    const slye = tvi.filter(([, , , , text]) => /^Joey Slye \d+ Yd Field Goal$/.test(text))
    expect(slye).toHaveLength(4)
    expect(slye.slice(-2).map(([q, clock]) => [q, clock])).toEqual([
      [4, '2:03'],
      [4, '0:43'],
    ])
    expect(tvi.at(-1)![1]).toBe('0:43')
    expect(record('TEN')).toBe('1-5')
  })

  it('“the Tennessee whose offense, I wrote last week, had less going on than our graveyard”', () => {
    // The week 5 review, as published (main at 96be99c), which this one replaces.
    expect(WEEK_5_REVIEW_SAID).toMatch(
      /the graveyard on this page now has more going on than the Tennessee offense/,
    )
    expect(body).toMatch(/I wrote last week, had less going on than our graveyard/)
  })

  it('“Arizona went into the red zone five times, scored zero touchdowns … Matthew Stafford threw two touchdowns and no interceptions. Arizona’s quarterback threw no touchdowns and an interception”', () => {
    const g = box('2026-w06-ARI-at-LAR')
    expect(g.teams.ARI!.redZone).toEqual([0, 5])
    expect(g.players['Matthew Stafford']).toMatchObject({
      team: 'LAR',
      touchdowns: 2,
      interceptions: 0,
    })
    expect(g.players['Jacoby Brissett']).toMatchObject({
      team: 'ARI',
      touchdowns: 0,
      interceptions: 1,
    })
    // He was Arizona's passer: his yards are all of theirs.
    expect(g.players['Jacoby Brissett']!.passingYards).toBe(g.teams.ARI!.passingYards)
    expect(g.players['Chad Ryland']!.fieldGoals).toEqual([6, 6])
  })

  it('“thirteen of you were safe for forty-seven seconds”', () => {
    const lead = SCORING['2026-w06-ARI-at-LAR']!.find(([, , , score]) => score.join() === '15,16')!
    expect(lead[1]).toBe('0:47')
    expect(SCORING['2026-w06-ARI-at-LAR']!.at(-1)![1]).toBe('0:00')
  })

  it('“Tennessee gained 186 yards, completed eleven passes and managed eleven first downs. Indianapolis gained 399 … a man named Joey — scored fourteen points by himself, including a 56-yard field goal”', () => {
    const g = box('2026-w06-TEN-at-IND')
    expect(g.teams.TEN).toMatchObject({ totalYards: 186, firstDowns: 11 })
    expect(g.players['Cam Ward']).toMatchObject({ team: 'TEN', completions: 11 })
    // He was Tennessee's only passer: his yards are all of theirs.
    expect(g.players['Cam Ward']!.passingYards).toBe(g.teams.TEN!.passingYards)
    expect(g.teams.IND!.totalYards).toBe(399)
    expect(g.players['Joey Slye']).toMatchObject({ team: 'TEN', points: 14, longest: 56 })
  })

  it('“went into the weekend twenty-four strong and came out of it twelve”', () => {
    expect([...before.values()].filter((l) => l > 0)).toHaveLength(24)
    expect([...after.values()].filter((l) => l > 0)).toHaveLength(12)
  })

  it('“More lives have now been lost in the last two weeks (forty-one) than in the first four combined (thirty-three)”', () => {
    const inWeeks = (...weeks: number[]) => livesLost.filter((l) => weeks.includes(l.week)).length
    expect(inWeeks(5, 6)).toBe(41)
    expect(inWeeks(1, 2, 3, 4)).toBe(33)
  })

  it('“Dallas remain this league’s leading cause of death, with twenty-two lives, but the Rams went from nothing to second place in one Sunday afternoon, with thirteen”', () => {
    const tally = new Map<string, number>()
    for (const l of livesLost) if (l.teamId) tally.set(l.teamId, (tally.get(l.teamId) ?? 0) + 1)
    const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1])
    expect(ranked[0]).toEqual(['DAL', 22])
    expect(ranked[1]).toEqual(['LAR', 13])
    expect(livesLost.filter((l) => l.teamId === 'LAR' && l.week < WEEK)).toHaveLength(0)
    expect(at(gamesById.get('2026-w06-ARI-at-LAR')!.kickoffAt)).toMatch(/^Sunday [1-4]:\d\d PM$/)
  })

  it('“The most popular pick has now lost two weeks running — 0-for-34”', () => {
    const top = (week: number) => {
      const counts = new Map<string, number>()
      for (const p of picksIn(week)) counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1)
      const most = Math.max(...counts.values())
      return [...counts.entries()].filter(([, n]) => n === most)
    }
    expect(top(5)).toEqual([['DAL', 21]])
    expect(top(6)).toEqual([['LAR', 13]])
    for (const w of [5, 6]) {
      const [team] = top(w)[0]!
      expect(
        picksIn(w)
          .filter((p) => p.teamId === team)
          .every(lost),
      ).toBe(true)
    }
    expect(21 + 13).toBe(34)
  })

  it('“Bradley, Cindy, Shahid and Tracy have already spent all three unbeaten teams, and only Jason and Melanie still have Kansas City”', () => {
    const alive = season.profiles.filter((p) => after.get(p.displayName)! > 0)
    const used = (playerId: string) =>
      new Set(season.picks.filter((p) => p.playerId === playerId).map((p) => p.teamId))
    const all3 = alive.filter((p) => ['SF', 'MIN', 'KC'].every((t) => used(p.playerId).has(t)))
    expect(firstNames(all3.map((p) => p.displayName))).toEqual([
      'Bradley',
      'Cindy',
      'Shahid',
      'Tracy',
    ])
    const kc = alive.filter((p) => !used(p.playerId).has('KC'))
    expect(firstNames(kc.map((p) => p.displayName))).toEqual(['Jason', 'Melanie'])
    const teams = new Set(season.games.flatMap((g) => [g.homeTeamId, g.awayTeamId]))
    expect([...teams].filter((t) => /^\d+-0$/.test(record(t))).sort()).toEqual(['KC', 'MIN', 'SF'])
  })

  it('“Our Joey has been in the ground a week”', () => {
    expect(eliminatedWeekOf('joseph-tomczuk', WEEK)).toBe(5)
  })

  it('“twelve of you were knocked out this week. James, Stacey, Sheila, Matt, KC, Paul, Tony, Tina and I went down with the Rams; Chloe, Corey and Joanna with the Colts”', () => {
    const out = outIn(WEEK)
    expect(out).toHaveLength(12)
    const by = (team: string) => firstNames(out.filter((n) => pickOf(n, WEEK)?.teamId === team))
    expect(by('LAR')).toEqual([
      'James',
      'KC',
      'Matt',
      'Paul',
      'Sheila',
      'Stacey',
      'Tina',
      'Tony',
      'Zac',
    ])
    expect(by('IND')).toEqual(['Chloe', 'Corey', 'Joanna'])
  })

  it('“Last week’s five was a league record; this week’s twelve is more than double it”', () => {
    expect(outIn(5)).toHaveLength(5)
    for (const w of [1, 2, 3, 4]) expect(outIn(w).length).toBeLessThan(5)
    expect(12).toBeGreaterThan(2 * 5)
  })

  it('“The graveyard went from six to eighteen … eighteen headstones, twelve survivors … Every one of the twelve has an epitaph”', () => {
    expect([...before.values()].filter((l) => l === 0)).toHaveLength(6)
    expect([...after.values()].filter((l) => l === 0)).toHaveLength(18)
    expect([...after.values()].filter((l) => l > 0)).toHaveLength(12)
    const epitaphs = readFileSync(new URL('../../src/lib/epitaphs.ts', import.meta.url), 'utf8')
    for (const p of season.profiles.filter((x) => eliminatedWeekOf(x.playerId, WEEK) === WEEK)) {
      expect(epitaphs, p.displayName).toMatch(
        new RegExp(`'${p.playerId}': \\{[\\s\\S]*?writtenAfterWeek: 6`),
      )
    }
  })

  it('“Bradley went alone with San Francisco, 23–17 over Washington, and the 49ers are 6–0, the only team in the league with six wins”', () => {
    expect(whoOn('SF')).toEqual(['Bradley'])
    expect(FINALS['2026-w06-WAS-at-SF']).toEqual([17, 23])
    expect(record('SF')).toBe('6-0')
    const teams = new Set(season.games.flatMap((g) => [g.homeTeamId, g.awayTeamId]))
    const sixWins = [...teams].filter((t) => Number(record(t).split('-')[0]) >= 6)
    expect(sixWins).toEqual(['SF'])
  })

  it('“Cindy, Dominic, Maya and Melanie took New England over the Jets, 26–19, on three Drake Maye touchdown passes”', () => {
    expect(whoOn('NE')).toEqual(['Cindy', 'Dominic', 'Maya', 'Melanie'])
    expect(FINALS['2026-w06-NYJ-at-NE']).toEqual([19, 26])
    expect(
      plays('2026-w06-NYJ-at-NE').filter(([, , , , text]) => /pass from Drake Maye/.test(text)),
    ).toHaveLength(3)
  })

  it('“The five who lost nothing”', () => {
    const kept = [...after.entries()].filter(([n, l]) => l > 0 && l === before.get(n))
    expect(firstNames(kept.map(([n]) => n))).toEqual([
      'Bradley',
      'Cindy',
      'Dominic',
      'Maya',
      'Melanie',
    ])
  })

  it('“Allison lost her first life of the season with the Colts … Cindy … the only one of us still holding all three: six picks, six wins. She and I picked the same team in weeks 2 and 3”', () => {
    expect(pickOf('Allison Petty', WEEK)?.teamId).toBe('IND')
    expect(before.get('Allison Petty')).toBe(3)
    expect(after.get('Allison Petty')).toBe(2)
    expect(onLives(3)).toEqual(['Cindy'])
    const cindy = season.picks.filter((p) => p.playerId === 'cindy-mendoza' && p.week <= WEEK)
    expect(cindy).toHaveLength(6)
    expect(cindy.some(lost)).toBe(false)
    const same = [1, 2, 3, 4, 5, 6].filter(
      (w) => pickOf('Cindy Mendoza', w)?.teamId === pickOf('Zac Harlan', w)?.teamId,
    )
    expect(same).toEqual([2, 3])
  })

  it('“Arizona have won two games all year — the Chargers in week 1 and the Rams this week — and Stacey, Tony and I picked Los Angeles both times”', () => {
    const arizonaWins = Object.keys(FINALS).filter((id) => winnerOf(id) === 'ARI')
    expect(arizonaWins).toEqual(['2026-w01-ARI-at-LAC', '2026-w06-ARI-at-LAR'])
    const both = picksIn(1)
      .filter((p) => p.teamId === 'LAC')
      .filter((p) => picksIn(6).some((q) => q.playerId === p.playerId && q.teamId === 'LAR'))
    expect(firstNames(both.map((p) => nameOf(p.playerId)))).toEqual(['Stacey', 'Tony', 'Zac'])
  })

  it('“The Chargers are now 0–6 … the seven of you who took them in week 1”', () => {
    expect(record('LAC')).toBe('0-6')
    expect(crowd(1, 'LAC')).toBe(7)
  })

  it('“Everyone who picked Seattle in week 3 — Don, James, Corey and Joanna — is now dead”', () => {
    const seattle = picksIn(3).filter((p) => p.teamId === 'SEA')
    expect(firstNames(seattle.map((p) => nameOf(p.playerId)))).toEqual([
      'Corey',
      'Don',
      'James',
      'Joanna',
    ])
    for (const p of seattle) expect(after.get(nameOf(p.playerId))).toBe(0)
  })

  it('“Paul is still the only one of us ever to lose a life to a tie”', () => {
    const ties = Object.keys(FINALS).filter((id) => winnerOf(id) === null)
    expect(ties).toEqual(['2026-w05-NYG-at-WAS'])
    expect(season.picks.filter((p) => ties.includes(p.gameId)).map((p) => p.playerId)).toEqual([
      'paul-lim',
    ])
  })

  it('“Dallas lost 23–13 in Green Bay on Sunday night … the twenty-one of you who rode them in week 5”', () => {
    expect(FINALS['2026-w06-DAL-at-GB']).toEqual([13, 23])
    expect(at(gamesById.get('2026-w06-DAL-at-GB')!.kickoffAt)).toMatch(/^Sunday [7-8]:\d\d PM$/)
    expect(crowd(5, 'DAL')).toBe(21)
  })

  it('“Joey: the Bears won 31–23 in Atlanta, their first game since you died”', () => {
    expect(FINALS['2026-w06-CHI-at-ATL']).toEqual([31, 23])
    expect(winnerOf('2026-w06-CHI-at-ATL')).toBe('CHI')
    const bears = season.games
      .filter((g) => [g.homeTeamId, g.awayTeamId].includes('CHI') && g.week < WEEK)
      .sort((a, b) => b.week - a.week)
    expect(bears[0]!.week).toBe(eliminatedWeekOf('joseph-tomczuk', WEEK))
  })

  it('“twelve alive. Cindy is on three lives, Allison and Melanie on two, and nine of you … are on your last”', () => {
    expect(onLives(3)).toEqual(['Cindy'])
    expect(onLives(2)).toEqual(['Allison', 'Melanie'])
    expect(onLives(1)).toEqual([
      'Bradley',
      'Dave',
      'Dominic',
      'Jason',
      'Maya',
      'Mike',
      'Shahid',
      'Tracy',
      'Wesley',
    ])
  })

  it('“Wesley sent no pick at all this week, lost a life for it, and is still standing because his first four picks all won”', () => {
    expect(pickOf('Wesley Childers', WEEK)).toBeNull()
    expect(before.get('Wesley Childers')).toBe(2)
    expect(after.get('Wesley Childers')).toBe(1)
    for (const w of [1, 2, 3, 4]) expect(lost(pickOf('Wesley Childers', w)!)).toBe(false)
  })

  it('“Week 7 … Buffalo, Jacksonville, Washington and the Chargers … New England at Chicago, two 4–2 teams … San Francisco (6–0) at Atlanta, Minnesota (5–0) at home to the Colts, and Kansas City (5–0) at Seattle on Sunday night. Miami, 0–5, visit the Jets.”', () => {
    const week7 = season.games.filter((g) => g.week === 7)
    const playing = new Set(week7.flatMap((g) => [g.homeTeamId, g.awayTeamId]))
    const all = new Set(season.games.flatMap((g) => [g.homeTeamId, g.awayTeamId]))
    expect([...all].filter((t) => !playing.has(t)).sort()).toEqual(['BUF', 'JAX', 'LAC', 'WAS'])
    // “the first week all season they cannot lose”: no bye before, and no win.
    for (let w = 1; w <= 6; w++) {
      expect(
        season.games.some((g) => g.week === w && [g.homeTeamId, g.awayTeamId].includes('LAC')),
      ).toBe(true)
    }
    expect(record('LAC')).toBe('0-6')
    const opener = [...week7].sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))[0]!
    expect([opener.awayTeamId, opener.homeTeamId]).toEqual(['NE', 'CHI'])
    expect(record('NE')).toBe('4-2')
    expect(record('CHI')).toBe('4-2')
    const unbeaten = [...all].filter((t) => /^\d+-0$/.test(record(t)))
    expect(unbeaten.sort()).toEqual(['KC', 'MIN', 'SF'])
    const game = (away: string, home: string) =>
      week7.find((g) => g.awayTeamId === away && g.homeTeamId === home)
    expect(game('SF', 'ATL')).toBeTruthy()
    expect(game('IND', 'MIN')).toBeTruthy()
    expect(at(game('KC', 'SEA')!.kickoffAt)).toMatch(/^Sunday [7-8]:\d\d PM$/)
    expect(record('KC')).toBe('5-0')
    expect(record('MIN')).toBe('5-0')
    expect(game('MIA', 'NYJ')).toBeTruthy()
    expect(record('MIA')).toBe('0-5')
  })

  it('“DM me your week 7 pick … before 7:10 PM Thursday — five minutes before New England at Chicago kicks off. Nine of you are on your last life”', () => {
    const week7 = season.games.filter((g) => g.week === 7)
    const opener = [...week7].sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))[0]!
    const lock = new Date(new Date(opener.kickoffAt).getTime() - 5 * 60_000)
    expect(at(lock.toISOString())).toBe('Thursday 7:10 PM')
    expect(onLives(1)).toHaveLength(9)
  })
})
