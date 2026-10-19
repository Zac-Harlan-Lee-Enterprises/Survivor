import { describe, expect, it } from 'vitest'
import { evaluateSeason } from '@/domain'
import { kickoffFor, scenario } from '@/domain/testing/scenario'
import { OLD_GRAVES_SHOWN, graveyardPreview } from './graveyard'

const FRESH = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8']
const OLD = ['o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7']

/**
 * Five settled weeks and a sixth to come. Eight players win weeks 1–2 and then
 * never pick again, so all eight go out together in week 5 — more than the old
 * six-grave cap. Seven never pick at all and went out in week 3. One survivor
 * wins every week, so nobody is crowned.
 */
function evaluation() {
  const b = scenario()
    .players('alive', ...FRESH, ...OLD)
    .game(1, 'GB', 'CHI', { final: 'GB' })
    .game(2, 'KC', 'LV', { final: 'KC' })
    .game(3, 'BUF', 'MIA', { final: 'BUF' })
    .game(4, 'PHI', 'DAL', { final: 'PHI' })
    .game(5, 'SF', 'SEA', { final: 'SF' })
    .game(6, 'DET', 'MIN')
    .pick('alive', 1, 'GB')
    .pick('alive', 2, 'KC')
    .pick('alive', 3, 'BUF')
    .pick('alive', 4, 'PHI')
    .pick('alive', 5, 'SF')
  for (const id of FRESH) b.pick(id, 1, 'GB').pick(id, 2, 'KC')
  return evaluateSeason(b.build(), { now: kickoffFor(5, 48) })
}

describe('graveyardPreview', () => {
  it('shows every grave dug last week, however many', () => {
    const e = evaluation()
    expect(e.currentWeek).toBe(6)
    const { fresh } = graveyardPreview(e.standings, e.currentWeek)
    expect(fresh.map((s) => s.playerId).sort()).toEqual(FRESH)
    expect(fresh.length).toBeGreaterThan(OLD_GRAVES_SHOWN)
    expect(fresh.every((s) => s.eliminatedWeek === 5)).toBe(true)
  })

  it('keeps older graves to one row, and never the living', () => {
    const e = evaluation()
    const { fresh, old } = graveyardPreview(e.standings, e.currentWeek)
    expect(old).toHaveLength(OLD_GRAVES_SHOWN)
    expect(old.every((s) => OLD.includes(s.playerId) && s.eliminatedWeek === 3)).toBe(true)
    expect([...fresh, ...old].some((s) => s.playerId === 'alive')).toBe(false)
  })

  it('is empty before anyone has died', () => {
    const e = evaluateSeason(
      scenario()
        .players('alive')
        .game(1, 'GB', 'CHI', { final: 'GB' })
        .pick('alive', 1, 'GB')
        .build(),
      { now: kickoffFor(1, 48) },
    )
    expect(graveyardPreview(e.standings, e.currentWeek)).toEqual({ fresh: [], old: [] })
  })
})
