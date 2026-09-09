import { describe, expect, it } from 'vitest'
import { evaluateSeason, findStanding, teamsOnBye, weekSummary } from './engine'
import { kickoffFor, scenario } from '../testing/scenario'

// "now" defaults to the Tuesday after week 3 — weeks 1–3 resolved, week 4 open.
const AFTER_WEEK_3 = kickoffFor(3, 48)

function standingOf(
  snapshot: ReturnType<typeof scenario>['build'] extends () => infer S ? S : never,
  id: string,
  now = AFTER_WEEK_3,
) {
  const s = findStanding(evaluateSeason(snapshot, { now }), id)
  if (!s) throw new Error(`no standing for ${id}`)
  return s
}

describe('life accounting', () => {
  it('a win consumes no life', () => {
    const snap = scenario()
      .players('ann')
      .game(1, 'GB', 'CHI', { final: 'GB' })
      .pick('ann', 1, 'GB')
      .build()
    const s = standingOf(snap, 'ann')
    expect(s.livesRemaining).toBe(3)
    expect(s.strikes).toBe(0)
    expect(s.history[0]?.outcome).toBe('win')
    expect(s.status).toBe('alive')
  })

  it('a loss consumes exactly one life', () => {
    const snap = scenario()
      .players('ann')
      .game(1, 'GB', 'CHI', { final: 'CHI' })
      .pick('ann', 1, 'GB')
      .build()
    const s = standingOf(snap, 'ann')
    expect(s.livesRemaining).toBe(2)
    expect(s.strikes).toBe(1)
    expect(s.history[0]?.outcome).toBe('loss')
    expect(s.history[0]?.consumedLife).toBe(true)
  })

  it('a tie consumes exactly one life', () => {
    const snap = scenario()
      .players('ann')
      .game(1, 'GB', 'CHI', { final: 'tie' })
      .pick('ann', 1, 'GB')
      .build()
    const s = standingOf(snap, 'ann')
    expect(s.history[0]?.outcome).toBe('tie')
    expect(s.livesRemaining).toBe(2)
    expect(s.strikes).toBe(1)
  })

  it('a tie does not cost a life when the league disables that rule', () => {
    const snap = scenario()
      .withSettings({ tieCountsAsMiss: false })
      .players('ann')
      .game(1, 'GB', 'CHI', { final: 'tie' })
      .pick('ann', 1, 'GB')
      .build()
    expect(standingOf(snap, 'ann').livesRemaining).toBe(3)
  })

  it('the third miss eliminates the player in that week', () => {
    const snap = scenario()
      .players('ann', 'bob')
      .game(1, 'GB', 'CHI', { final: 'CHI' })
      .game(2, 'KC', 'DEN', { final: 'DEN' })
      .game(3, 'DAL', 'PHI', { final: 'PHI' })
      .pick('ann', 1, 'GB')
      .pick('ann', 2, 'KC')
      .pick('ann', 3, 'DAL')
      .pick('bob', 1, 'CHI')
      .pick('bob', 2, 'DEN')
      .pick('bob', 3, 'PHI')
      .build()
    const ann = standingOf(snap, 'ann')
    expect(ann.status).toBe('eliminated')
    expect(ann.eliminatedWeek).toBe(3)
    expect(ann.livesRemaining).toBe(0)
    expect(ann.weeksSurvived).toBe(2)
    expect(ann.history[2]?.eliminatedHere).toBe(true)
  })

  it('a player with a lives override is eliminated on their own count', () => {
    const snap = scenario()
      .player('ann', { livesOverride: 1 })
      .player('bob')
      .game(1, 'GB', 'CHI', { final: 'CHI' })
      .pick('ann', 1, 'GB')
      .pick('bob', 1, 'CHI')
      .build()
    expect(standingOf(snap, 'ann').status).toBe('eliminated')
    expect(standingOf(snap, 'ann').livesTotal).toBe(1)
  })

  it('weeks after elimination are not required and cannot add strikes', () => {
    const snap = scenario()
      .player('ann', { livesOverride: 1 })
      .player('bob')
      .game(1, 'GB', 'CHI', { final: 'CHI' })
      .game(2, 'KC', 'DEN', { final: 'DEN' })
      .pick('ann', 1, 'GB')
      .pick('ann', 2, 'KC')
      .pick('bob', 1, 'CHI')
      .pick('bob', 2, 'DEN')
      .build()
    const ann = standingOf(snap, 'ann')
    expect(ann.strikes).toBe(1)
    expect(ann.history[1]?.outcome).toBe('not_required')
  })
})

describe('missing picks', () => {
  it('no pick while the week is still open is pending, not a strike', () => {
    const snap = scenario().players('ann').game(1, 'GB', 'CHI').build()
    const s = standingOf(snap, 'ann', kickoffFor(1, -24))
    expect(s.history[0]?.outcome).toBe('pending')
    expect(s.strikes).toBe(0)
  })

  it('no pick once the deadline passes is a miss, and the deadline is before the FIRST kickoff', () => {
    const snap = scenario()
      .players('ann')
      .game(1, 'GB', 'CHI', { kickoff: kickoffFor(1, 0) })
      .game(1, 'KC', 'DEN', { kickoff: kickoffFor(1, 7) })
      .build()
    // Ten minutes before the first kickoff: still open (default lead is 5 min).
    expect(standingOf(snap, 'ann', kickoffFor(1, -10 / 60)).history[0]?.outcome).toBe('pending')
    // Four minutes before it: the deadline has passed, so it is a miss.
    const s = standingOf(snap, 'ann', kickoffFor(1, -4 / 60))
    expect(s.history[0]?.outcome).toBe('missing')
    expect(s.livesRemaining).toBe(2)
  })

  it('missing pick does not cost a life when the league disables that rule', () => {
    const snap = scenario()
      .withSettings({ missingPickCountsAsMiss: false })
      .players('ann')
      .game(1, 'GB', 'CHI', { final: 'GB' })
      .build()
    expect(standingOf(snap, 'ann').livesRemaining).toBe(3)
  })

  it('a week with no schedule data never strikes anyone', () => {
    const snap = scenario()
      .players('ann')
      .game(2, 'GB', 'CHI', { final: 'GB' })
      .pick('ann', 2, 'GB')
      .build()
    const ev = evaluateSeason(snap, { now: AFTER_WEEK_3 })
    expect(weekSummary(ev, 1)?.phase).toBe('no-data')
    expect(findStanding(ev, 'ann')?.history[0]?.outcome).toBe('not_required')
    expect(findStanding(ev, 'ann')?.strikes).toBe(0)
  })
})

describe('teams used and remaining', () => {
  it('a team is consumed once its game is locked or resolved', () => {
    const snap = scenario()
      .players('ann')
      .game(1, 'GB', 'CHI', { final: 'GB' })
      .game(2, 'KC', 'DEN')
      .pick('ann', 1, 'GB')
      .pick('ann', 2, 'KC')
      .build()
    // Before week 2 kickoff: only GB is consumed; the KC pick can still change.
    const before = standingOf(snap, 'ann', kickoffFor(2, -1))
    expect(before.teamsUsed).toEqual(['GB'])
    expect(before.teamsRemaining).toHaveLength(31)
    // After week 2 kickoff: KC locked in.
    const after = standingOf(snap, 'ann', kickoffFor(2, 1))
    expect(after.teamsUsed).toEqual(['GB', 'KC'])
    expect(after.teamsRemaining).toHaveLength(30)
  })

  it('different players may use the same team', () => {
    const snap = scenario()
      .players('ann', 'bob')
      .game(1, 'GB', 'CHI', { final: 'GB' })
      .pick('ann', 1, 'GB')
      .pick('bob', 1, 'GB')
      .build()
    expect(standingOf(snap, 'ann').history[0]?.outcome).toBe('win')
    expect(standingOf(snap, 'bob').history[0]?.outcome).toBe('win')
  })

  it('a cancelled game voids the pick and returns the team to the pool', () => {
    const snap = scenario()
      .players('ann')
      .game(1, 'GB', 'CHI', { status: 'cancelled' })
      .game(1, 'KC', 'DEN', { final: 'KC' })
      .pick('ann', 1, 'GB')
      .build()
    const s = standingOf(snap, 'ann')
    expect(s.history[0]?.outcome).toBe('void')
    expect(s.strikes).toBe(0)
    expect(s.teamsUsed).toEqual([])
  })

  it('a cancelled game counts as a miss when the league says so', () => {
    const snap = scenario()
      .withSettings({ cancelledGamePolicy: 'miss' })
      .players('ann')
      .game(1, 'GB', 'CHI', { status: 'cancelled' })
      .game(1, 'KC', 'DEN', { final: 'KC' })
      .pick('ann', 1, 'GB')
      .build()
    expect(standingOf(snap, 'ann').strikes).toBe(1)
  })

  it('a postponed game keeps the pick pending instead of striking', () => {
    const snap = scenario()
      .players('ann')
      .game(1, 'GB', 'CHI', { status: 'postponed' })
      .game(1, 'KC', 'DEN', { final: 'KC' })
      .pick('ann', 1, 'GB')
      .build()
    const ev = evaluateSeason(snap, { now: AFTER_WEEK_3 })
    expect(findStanding(ev, 'ann')?.history[0]?.outcome).toBe('pending')
    expect(weekSummary(ev, 1)?.settled).toBe(false)
  })
})

describe('week phases and current week', () => {
  it('reports open, locked and final phases, with the deadline five minutes before the first kickoff', () => {
    const snap = scenario()
      .players('ann')
      .game(1, 'GB', 'CHI', { final: 'GB' })
      .game(2, 'KC', 'DEN', { kickoff: kickoffFor(2, 0) })
      .game(2, 'DAL', 'PHI', { kickoff: kickoffFor(2, 7) })
      .game(3, 'SF', 'SEA', { kickoff: kickoffFor(3, 0) })
      .build()
    const ev = evaluateSeason(snap, { now: kickoffFor(2, 8) })
    expect(weekSummary(ev, 1)?.phase).toBe('final')
    expect(weekSummary(ev, 2)?.phase).toBe('locked')
    expect(weekSummary(ev, 2)?.firstKickoffAt).toBe(kickoffFor(2, 0))
    expect(weekSummary(ev, 2)?.lastKickoffAt).toBe(kickoffFor(2, 7))
    expect(weekSummary(ev, 2)?.deadlineAt).toBe(kickoffFor(2, -5 / 60))
    expect(weekSummary(ev, 3)?.phase).toBe('upcoming')
    expect(ev.currentWeek).toBe(2)
  })

  it('locks the whole league at once: a Monday-night pick cannot change after the Sunday deadline', () => {
    const snap = scenario()
      .players('ann')
      .game(2, 'KC', 'DEN', { kickoff: kickoffFor(2, 0) })
      .game(2, 'DAL', 'PHI', { kickoff: kickoffFor(2, 30) })
      .pick('ann', 2, 'DAL')
      .build()
    // An hour after the first kickoff, the Cowboys have not played yet — but
    // the deadline passed before that first kickoff, so the pick is locked.
    const ev = evaluateSeason(snap, { now: kickoffFor(2, 1) })
    const h = findStanding(ev, 'ann')!.history.find((x) => x.week === 2)!
    expect(h.locked).toBe(true)
    expect(h.outcome).toBe('pending')
  })

  it('honours a league that locks at a different lead time', () => {
    const build = (lead: number) =>
      scenario()
        .withSettings({ pickLockMinutesBeforeFirstKickoff: lead })
        .players('ann')
        .game(1, 'GB', 'CHI', { kickoff: kickoffFor(1, 0) })
        .build()
    expect(evaluateSeason(build(60), { now: kickoffFor(1, -2) }).weeks[0]?.deadlineAt).toBe(
      kickoffFor(1, -1),
    )
    expect(evaluateSeason(build(0), { now: kickoffFor(1, -2) }).weeks[0]?.deadlineAt).toBe(
      kickoffFor(1, 0),
    )
  })

  it('a week whose games are all cancelled is final and requires nothing', () => {
    const snap = scenario()
      .players('ann')
      .game(1, 'GB', 'CHI', { status: 'cancelled' })
      .game(2, 'KC', 'DEN')
      .build()
    const ev = evaluateSeason(snap, { now: kickoffFor(1, 30) })
    expect(weekSummary(ev, 1)?.phase).toBe('final')
    expect(ev.currentWeek).toBe(2)
    expect(findStanding(ev, 'ann')?.strikes).toBe(0)
  })
})

describe('champions', () => {
  it('crowns the last player standing once the deciding week settles', () => {
    const snap = scenario()
      .players('ann', 'bob')
      .player('cat', { livesOverride: 1 })
      .player('dan', { livesOverride: 1 })
      .game(1, 'GB', 'CHI', { final: 'GB' })
      .game(1, 'KC', 'DEN', { final: 'KC' })
      .pick('ann', 1, 'GB')
      .pick('bob', 1, 'GB')
      .pick('cat', 1, 'CHI')
      .pick('dan', 1, 'DEN')
      .build()
    // Two remain, so no champion yet.
    const ev = evaluateSeason(snap, { now: AFTER_WEEK_3 })
    expect(ev.championIds).toEqual([])
    expect(ev.isComplete).toBe(false)
  })

  it('a sole survivor is champion; later weeks are not required', () => {
    const snap = scenario()
      .players('ann')
      .player('bob', { livesOverride: 1 })
      .game(1, 'GB', 'CHI', { final: 'GB' })
      .game(2, 'KC', 'DEN', { final: 'DEN' })
      .pick('ann', 1, 'GB')
      .pick('bob', 1, 'CHI')
      .pick('ann', 2, 'KC')
      .build()
    const ev = evaluateSeason(snap, { now: AFTER_WEEK_3 })
    expect(ev.championIds).toEqual(['ann'])
    expect(ev.decidedWeek).toBe(1)
    expect(ev.isComplete).toBe(true)
    const ann = findStanding(ev, 'ann')!
    expect(ann.status).toBe('champion')
    // Week 2 loss after the crown does not count.
    expect(ann.strikes).toBe(0)
    expect(ann.history[1]?.outcome).toBe('not_required')
  })

  it('does not crown while the deciding week still has pending games', () => {
    const snap = scenario()
      .players('ann')
      .player('bob', { livesOverride: 1 })
      .game(1, 'GB', 'CHI', { final: 'CHI', kickoff: kickoffFor(1, 0) })
      .game(1, 'KC', 'DEN', { kickoff: kickoffFor(1, 7) })
      .pick('ann', 1, 'KC')
      .pick('bob', 1, 'GB')
      .build()
    const ev = evaluateSeason(snap, { now: kickoffFor(1, 3) })
    expect(findStanding(ev, 'bob')?.status).toBe('eliminated')
    expect(ev.championIds).toEqual([])
    expect(ev.isComplete).toBe(false)
  })

  it('everyone eliminated in the same week → co-champions by default', () => {
    const snap = scenario()
      .player('ann', { livesOverride: 1 })
      .player('bob', { livesOverride: 1 })
      .game(1, 'GB', 'CHI', { final: 'CHI' })
      .pick('ann', 1, 'GB')
      .pick('bob', 1, 'GB')
      .build()
    const ev = evaluateSeason(snap, { now: AFTER_WEEK_3 })
    expect(ev.championIds.sort()).toEqual(['ann', 'bob'])
    expect(findStanding(ev, 'ann')?.status).toBe('co-champion')
  })

  it('everyone eliminated in the same week → tied finalists when the commissioner decides', () => {
    const snap = scenario()
      .withSettings({ simultaneousEliminationPolicy: 'commissioner-decides' })
      .player('ann', { livesOverride: 1 })
      .player('bob', { livesOverride: 1 })
      .game(1, 'GB', 'CHI', { final: 'CHI' })
      .pick('ann', 1, 'GB')
      .pick('bob', 1, 'GB')
      .build()
    const ev = evaluateSeason(snap, { now: AFTER_WEEK_3 })
    expect(ev.championIds).toEqual([])
    expect(ev.finalistIds.sort()).toEqual(['ann', 'bob'])
    expect(findStanding(ev, 'ann')?.status).toBe('finalist')
    expect(ev.isComplete).toBe(false)

    // A recorded commissioner decision resolves it.
    const decided = evaluateSeason(
      {
        ...snap,
        decision: {
          seasonId: 'season-1',
          championPlayerIds: ['bob'],
          reason: 'tiebreaker: most wins',
          actorPlayerId: 'commish',
          decidedAt: '2026-10-01T00:00:00.000Z',
        },
      },
      { now: AFTER_WEEK_3 },
    )
    expect(decided.championIds).toEqual(['bob'])
    expect(findStanding(decided, 'bob')?.status).toBe('champion')
    expect(findStanding(decided, 'ann')?.status).toBe('eliminated')
    expect(decided.isComplete).toBe(true)
  })

  it('multiple survivors after the final week are co-champions', () => {
    const snap = scenario()
      .weeks(1, 2)
      .players('ann', 'bob')
      .game(1, 'GB', 'CHI', { final: 'GB' })
      .game(2, 'KC', 'DEN', { final: 'KC' })
      .pick('ann', 1, 'GB')
      .pick('bob', 1, 'GB')
      .pick('ann', 2, 'KC')
      .pick('bob', 2, 'KC')
      .build()
    const ev = evaluateSeason(snap, { now: AFTER_WEEK_3 })
    expect(ev.championIds.sort()).toEqual(['ann', 'bob'])
    expect(ev.isComplete).toBe(true)
  })
})

describe('commissioner corrections recalculate standings', () => {
  it('a game-result override flips a loss to a win and restores the life', () => {
    const base = scenario()
      .players('ann', 'bob')
      .game(1, 'GB', 'CHI', { final: 'CHI' })
      .pick('ann', 1, 'GB')
      .pick('bob', 1, 'CHI')
    const before = standingOf(base.build(), 'ann')
    expect(before.livesRemaining).toBe(2)

    const corrected = base
      .override('g-1-CHI-GB', { status: 'final', homeScore: 24, awayScore: 20, winnerTeamId: 'GB' })
      .build()
    const after = standingOf(corrected, 'ann')
    expect(after.livesRemaining).toBe(3)
    expect(after.history[0]?.outcome).toBe('win')
    expect(standingOf(corrected, 'bob').history[0]?.outcome).toBe('loss')
  })

  it('an override that un-eliminates a player also removes an undeserved champion', () => {
    const base = scenario()
      .players('ann')
      .player('bob', { livesOverride: 1 })
      .game(1, 'GB', 'CHI', { final: 'GB' })
      .pick('ann', 1, 'GB')
      .pick('bob', 1, 'CHI')
    expect(evaluateSeason(base.build(), { now: AFTER_WEEK_3 }).championIds).toEqual(['ann'])
    const corrected = base
      .override('g-1-CHI-GB', {
        status: 'final',
        winnerTeamId: 'CHI',
        homeScore: 10,
        awayScore: 13,
      })
      .build()
    const ev = evaluateSeason(corrected, { now: AFTER_WEEK_3 })
    expect(ev.championIds).toEqual([])
    expect(findStanding(ev, 'bob')?.status).toBe('alive')
    expect(findStanding(ev, 'ann')?.livesRemaining).toBe(2)
  })
})

describe('standings order and inactive members', () => {
  it('sorts champions, then alive by strikes, then the graveyard most-recent first', () => {
    const snap = scenario()
      .players('perfect', 'wobbly')
      .player('early', { livesOverride: 1 })
      .player('late', { livesOverride: 1 })
      .player('ghost', { status: 'inactive' })
      .game(1, 'GB', 'CHI', { final: 'GB' })
      .game(2, 'KC', 'DEN', { final: 'KC' })
      .pick('perfect', 1, 'GB')
      .pick('perfect', 2, 'KC')
      .pick('wobbly', 1, 'CHI')
      .pick('wobbly', 2, 'KC')
      .pick('early', 1, 'CHI')
      .pick('late', 1, 'GB')
      .pick('late', 2, 'DEN')
      .build()
    const ev = evaluateSeason(snap, { now: AFTER_WEEK_3 })
    expect(ev.standings.map((s) => s.playerId)).toEqual([
      'perfect',
      'wobbly',
      'late',
      'early',
      'ghost',
    ])
    expect(ev.standings.map((s) => s.rank)).toEqual([1, 2, 3, 4, 5])
    expect(findStanding(ev, 'ghost')?.status).toBe('inactive')
    expect(findStanding(ev, 'perfect')?.streak).toBe(2)
    expect(findStanding(ev, 'wobbly')?.streak).toBe(1)
  })

  it('is deterministic: the same input always evaluates identically', () => {
    const snap = scenario()
      .players('ann', 'bob')
      .fullWeek(1, { byes: ['GB', 'CHI'], finals: { KC: 'KC', DAL: 'DAL' } })
      .pick('ann', 1, 'KC')
      .pick('bob', 1, 'DAL')
      .build()
    const a = evaluateSeason(snap, { now: AFTER_WEEK_3 })
    const b = evaluateSeason(structuredClone(snap), { now: AFTER_WEEK_3 })
    expect(a).toEqual(b)
    expect(weekSummary(a, 1)?.gamesTotal).toBe(15)
  })
})

describe('teams on bye', () => {
  const snap = scenario()
    .players('ann')
    .game(1, 'GB', 'CHI')
    .game(1, 'KC', 'DEN')
    .game(2, 'GB', 'KC')
    .build()

  it('names every team without a game that week', () => {
    const bye = teamsOnBye(snap.games, snap.season.year, 2).map((t) => t.id)
    expect(bye).toContain('CHI')
    expect(bye).toContain('DEN')
    expect(bye).not.toContain('GB')
    expect(bye).not.toContain('KC')
    // 32 teams, two of them playing.
    expect(bye).toHaveLength(30)
  })

  it('counts a team as playing whichever side it is on', () => {
    const bye = teamsOnBye(snap.games, snap.season.year, 1).map((t) => t.id)
    for (const id of ['GB', 'CHI', 'KC', 'DEN']) expect(bye).not.toContain(id)
  })

  /** A provider outage is missing data, not a league-wide bye week. */
  it('returns nothing for a week with no schedule at all', () => {
    expect(teamsOnBye(snap.games, snap.season.year, 9)).toEqual([])
  })

  it('ignores games from another season', () => {
    expect(teamsOnBye(snap.games, snap.season.year + 1, 1)).toEqual([])
  })

  it('is sorted by name, so the list does not reshuffle between renders', () => {
    const names = teamsOnBye(snap.games, snap.season.year, 2).map((t) => t.fullName)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  })
})
