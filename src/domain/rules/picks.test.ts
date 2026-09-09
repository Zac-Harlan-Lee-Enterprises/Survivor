import { describe, expect, it } from 'vitest'
import { evaluateSeason } from './engine'
import { getTeamOptions, isPickVisible, redactPicks, redactSnapshot, validatePick } from './picks'
import { kickoffFor, scenario } from '../testing/scenario'

function codes(result: ReturnType<typeof validatePick>): string[] {
  return result.ok ? [] : result.violations.map((v) => v.code)
}

describe('validatePick', () => {
  const base = () =>
    scenario()
      .players('ann', 'bob')
      .game(1, 'GB', 'CHI', { final: 'GB' })
      .game(2, 'KC', 'DEN', { kickoff: kickoffFor(2, 0) })
      .game(2, 'DAL', 'PHI', { kickoff: kickoffFor(2, 7) })
      .game(2, 'SF', 'SEA', { kickoff: kickoffFor(2, 7), status: 'cancelled' })
      .pick('ann', 1, 'GB')
      .pick('bob', 1, 'GB')

  it('accepts an available team before kickoff', () => {
    const snap = base().build()
    const now = kickoffFor(2, -24)
    const result = validatePick(
      snap,
      evaluateSeason(snap, { now }),
      { playerId: 'ann', week: 2, teamId: 'kc' },
      now,
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.game.id).toBe('g-2-DEN-KC')
  })

  it('rejects a team the player already used', () => {
    const snap = base().game(2, 'GB', 'ARI').build()
    const now = kickoffFor(2, -24)
    const result = validatePick(
      snap,
      evaluateSeason(snap, { now }),
      { playerId: 'ann', week: 2, teamId: 'GB' },
      now,
    )
    expect(codes(result)).toContain('TEAM_ALREADY_USED')
  })

  it('rejects a team on bye', () => {
    const snap = base().build()
    const now = kickoffFor(2, -24)
    const result = validatePick(
      snap,
      evaluateSeason(snap, { now }),
      { playerId: 'ann', week: 2, teamId: 'MIA' },
      now,
    )
    expect(codes(result)).toEqual(['TEAM_NOT_PLAYING'])
  })

  it('locks EVERY team once the deadline passes, including later games', () => {
    const snap = base().build()
    const now = kickoffFor(2, 1)
    const started = validatePick(
      snap,
      evaluateSeason(snap, { now }),
      { playerId: 'ann', week: 2, teamId: 'KC' },
      now,
    )
    expect(codes(started)).toContain('WEEK_LOCKED')
    // The Cowboys do not kick off for hours, but the league locked together.
    const later = validatePick(
      snap,
      evaluateSeason(snap, { now }),
      { playerId: 'ann', week: 2, teamId: 'DAL' },
      now,
    )
    expect(codes(later)).toContain('WEEK_LOCKED')
  })

  it('rejects a cancelled game', () => {
    const snap = base().build()
    const now = kickoffFor(2, -24)
    const result = validatePick(
      snap,
      evaluateSeason(snap, { now }),
      { playerId: 'ann', week: 2, teamId: 'SF' },
      now,
    )
    expect(codes(result)).toEqual(['GAME_CANCELLED'])
  })

  it('a pick cannot change once its own game kicked off, even to a later game', () => {
    const snap = base().pick('ann', 2, 'KC').build()
    const now = kickoffFor(2, 1)
    const result = validatePick(
      snap,
      evaluateSeason(snap, { now }),
      { playerId: 'ann', week: 2, teamId: 'DAL' },
      now,
    )
    expect(codes(result)).toContain('EXISTING_PICK_LOCKED')
  })

  it('a pick can change right up to the deadline', () => {
    const snap = base().pick('ann', 2, 'KC').build()
    // Deadline is five minutes before the first kickoff; this is just inside it.
    const now = kickoffFor(2, -6 / 60)
    const result = validatePick(
      snap,
      evaluateSeason(snap, { now }),
      { playerId: 'ann', week: 2, teamId: 'DAL', expectedVersion: 1 },
      now,
    )
    expect(result.ok).toBe(true)
  })

  it('detects a stale version (concurrent change)', () => {
    const snap = base().pick('ann', 2, 'KC', { version: 3 }).build()
    const now = kickoffFor(2, -24)
    const result = validatePick(
      snap,
      evaluateSeason(snap, { now }),
      { playerId: 'ann', week: 2, teamId: 'DAL', expectedVersion: 2 },
      now,
    )
    expect(codes(result)).toEqual(['VERSION_CONFLICT'])
  })

  it('rejects picks for a week that is not the current week', () => {
    const snap = base().game(3, 'MIA', 'NYJ').build()
    const now = kickoffFor(2, -24)
    const result = validatePick(
      snap,
      evaluateSeason(snap, { now }),
      { playerId: 'ann', week: 3, teamId: 'MIA' },
      now,
    )
    expect(codes(result)).toContain('WEEK_NOT_OPEN')
  })

  it('rejects eliminated, inactive and unknown players', () => {
    const snap = scenario()
      .player('out', { livesOverride: 1 })
      .player('ghost', { status: 'inactive' })
      .player('ok')
      .game(1, 'GB', 'CHI', { final: 'CHI' })
      .game(2, 'KC', 'DEN')
      .pick('out', 1, 'GB')
      .pick('ok', 1, 'CHI')
      .build()
    const now = kickoffFor(2, -24)
    const ev = evaluateSeason(snap, { now })
    expect(
      codes(validatePick(snap, ev, { playerId: 'out', week: 2, teamId: 'KC' }, now)),
    ).toContain('PLAYER_ELIMINATED')
    expect(
      codes(validatePick(snap, ev, { playerId: 'ghost', week: 2, teamId: 'KC' }, now)),
    ).toContain('PLAYER_INACTIVE')
    expect(
      codes(validatePick(snap, ev, { playerId: 'nobody', week: 2, teamId: 'KC' }, now)),
    ).toEqual(['PLAYER_NOT_FOUND'])
  })

  it('rejects an unknown team id', () => {
    const snap = base().build()
    const now = kickoffFor(2, -24)
    expect(
      codes(
        validatePick(
          snap,
          evaluateSeason(snap, { now }),
          { playerId: 'ann', week: 2, teamId: 'XYZ' },
          now,
        ),
      ),
    ).toEqual(['TEAM_UNKNOWN'])
  })
})

describe('getTeamOptions', () => {
  const optionScenario = () =>
    scenario()
      .players('ann')
      .game(1, 'GB', 'CHI', { final: 'GB' })
      .game(2, 'KC', 'DEN', { kickoff: kickoffFor(2, 0) })
      .game(2, 'DAL', 'PHI', { kickoff: kickoffFor(2, 7) })
      .game(2, 'SF', 'SEA', { kickoff: kickoffFor(2, 7), status: 'cancelled' })
      .pick('ann', 1, 'GB')
      .pick('ann', 2, 'DAL')
      .build()

  it('classifies every team while the week is open', () => {
    const snap = optionScenario()
    const now = kickoffFor(2, -1)
    const options = getTeamOptions(snap, evaluateSeason(snap, { now }), 'ann', 2, now)
    const state = (id: string) => options.find((o) => o.team.id === id)!
    expect(state('GB').state).toBe('used')
    expect(state('GB').usedWeek).toBe(1)
    expect(state('KC').state).toBe('available')
    expect(state('DAL').state).toBe('selected')
    expect(state('PHI').state).toBe('available')
    expect(state('PHI').opponentId).toBe('DAL')
    expect(state('PHI').isHome).toBe(false)
    expect(state('SF').state).toBe('cancelled')
    expect(state('MIA').state).toBe('bye')
    expect(options).toHaveLength(32)
  })

  it('marks every playable team locked once the deadline passes', () => {
    const snap = optionScenario()
    const now = kickoffFor(2, 1)
    const options = getTeamOptions(snap, evaluateSeason(snap, { now }), 'ann', 2, now)
    const state = (id: string) => options.find((o) => o.team.id === id)!
    expect(state('KC').state).toBe('locked')
    // Not yet kicked off, but the league is locked.
    expect(state('PHI').state).toBe('locked')
    expect(state('DAL').state).toBe('selected')
    expect(state('GB').state).toBe('used')
    expect(state('MIA').state).toBe('bye')
  })
})

describe('pick visibility', () => {
  const snap = scenario()
    .players('ann', 'bob')
    .game(1, 'GB', 'CHI', { kickoff: kickoffFor(1, 0) })
    .game(1, 'KC', 'DEN', { kickoff: kickoffFor(1, 7) })
    .pick('ann', 1, 'GB')
    .pick('bob', 1, 'KC')
    .build()
  const game = (id: string) => snap.games.find((g) => g.id === id)!
  const annPick = snap.picks[0]!

  it('hides other players’ picks until the pick deadline', () => {
    const viewer = { playerId: 'bob', isCommissioner: false }
    const deadline = kickoffFor(1, -5 / 60)
    expect(
      isPickVisible(
        annPick,
        game(annPick.gameId),
        viewer,
        kickoffFor(1, -1),
        snap.league.settings,
        deadline,
      ),
    ).toBe(false)
    expect(
      isPickVisible(
        annPick,
        game(annPick.gameId),
        viewer,
        deadline,
        snap.league.settings,
        deadline,
      ),
    ).toBe(true)
  })

  it('always shows your own pick and everything to the commissioner', () => {
    expect(
      isPickVisible(
        annPick,
        game(annPick.gameId),
        { playerId: 'ann', isCommissioner: false },
        kickoffFor(1, -1),
        snap.league.settings,
      ),
    ).toBe(true)
    expect(
      isPickVisible(
        annPick,
        game(annPick.gameId),
        { playerId: null, isCommissioner: true },
        kickoffFor(1, -1),
        snap.league.settings,
      ),
    ).toBe(true)
  })

  it('redactPicks reveals the whole league at the deadline, not game by game', () => {
    // Bob picked the late KC game; after the deadline his pick is public too.
    const afterDeadline = redactPicks(
      snap,
      { playerId: 'ann', isCommissioner: false },
      kickoffFor(1, -4 / 60),
    )
    expect(afterDeadline.map((p) => p.playerId).sort()).toEqual(['ann', 'bob'])
    const early = redactPicks(snap, { playerId: 'bob', isCommissioner: false }, kickoffFor(1, -1))
    expect(early.map((p) => p.playerId)).toEqual(['bob'])
    const anon = redactPicks(snap, { playerId: null, isCommissioner: false }, kickoffFor(1, -1))
    expect(anon).toEqual([])
  })

  it('shows everything when the league turns off hiding', () => {
    const open = {
      ...snap,
      league: {
        ...snap.league,
        settings: { ...snap.league.settings, hidePicksUntilLocked: false },
      },
    }
    expect(
      redactPicks(open, { playerId: null, isCommissioner: false }, kickoffFor(1, -5)),
    ).toHaveLength(2)
  })
})

describe('redactSnapshot', () => {
  it('replaces hidden picks with (playerId, week) stubs', () => {
    const snap = scenario()
      .players('ann', 'bob')
      .game(1, 'GB', 'CHI', { kickoff: kickoffFor(1, 0) })
      .game(1, 'KC', 'DEN', { kickoff: kickoffFor(1, 7) })
      .pick('ann', 1, 'GB')
      .pick('bob', 1, 'KC')
      .build()
    const forBob = redactSnapshot(
      snap,
      { playerId: 'bob', isCommissioner: false },
      kickoffFor(1, -1),
    )
    expect(forBob.picks.map((p) => p.playerId)).toEqual(['bob'])
    expect(forBob.hiddenPicks).toEqual([{ playerId: 'ann', week: 1 }])
    const forCommish = redactSnapshot(
      snap,
      { playerId: null, isCommissioner: true },
      kickoffFor(1, -1),
    )
    expect(forCommish.picks).toHaveLength(2)
    expect(forCommish.hiddenPicks).toEqual([])
  })
})
