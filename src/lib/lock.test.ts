import { describe, expect, it } from 'vitest'
import { evaluateSeason } from '@/domain'
import { kickoffFor, scenario } from '@/domain/testing/scenario'
import { msUntilLock } from './lock'

const snap = scenario()
  .players('ann')
  .game(1, 'GB', 'CHI', { kickoff: kickoffFor(1, 0) })
  .game(2, 'KC', 'LV', { kickoff: kickoffFor(2, 0) })
  .build()
const at = (hours: number) => new Date(kickoffFor(1, hours))
const lead = snap.league.settings.pickLockMinutesBeforeFirstKickoff * 60_000

describe('msUntilLock', () => {
  it('counts down to the lock once it is within the hour', () => {
    const now = at(-0.5)
    const ms = msUntilLock(evaluateSeason(snap, { now }), now)
    expect(ms).toBe(30 * 60_000 - lead)
  })

  it('sets no timer for a lock that is hours or weeks away', () => {
    const now = at(-30)
    expect(msUntilLock(evaluateSeason(snap, { now }), now)).toBeNull()
  })

  it('fires at once when the clock has passed a lock the evaluation has not seen', () => {
    // The evaluation is from a tick before the lock; the real clock is past it.
    const evaluation = evaluateSeason(snap, { now: at(-0.2) })
    expect(msUntilLock(evaluation, at(-0.01))).toBe(0)
  })

  it('sets none once the week is locked', () => {
    const now = at(0.5)
    expect(msUntilLock(evaluateSeason(snap, { now }), now)).toBeNull()
  })
})
