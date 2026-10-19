import { describe, expect, it } from 'vitest'
import { evaluateSeason } from '@/domain'
import { kickoffFor, scenario } from '@/domain/testing/scenario'
import { funeralWeek, graveyardPreview } from './graveyard'

const WEEK5 = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8']
const WEEK3 = ['o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7']

/**
 * Five settled weeks and a sixth to come. Eight players win weeks 1–2 and never
 * pick again, so all eight go out together in week 5 — more than the page used
 * to have room for. Seven never pick at all and went out in week 3. `late` is
 * down to a last life by week 5 and forgets week 6. `alive` wins everything,
 * so nobody is crowned.
 */
function season() {
  const b = scenario()
    .players('alive', 'late', ...WEEK5, ...WEEK3)
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
    .pick('alive', 6, 'DET')
    .pick('late', 1, 'GB')
    .pick('late', 2, 'KC')
    .pick('late', 5, 'SF')
  for (const id of WEEK5) b.pick(id, 1, 'GB').pick(id, 2, 'KC')
  return b.build()
}
const ids = (xs: { playerId: string }[]) => xs.map((s) => s.playerId).sort()

describe('graveyardPreview', () => {
  it('gives every one of the week’s dead a funeral, however many', () => {
    // Tuesday after week 5: its games are done, week 6 is open for picks.
    const e = evaluateSeason(season(), { now: kickoffFor(5, 48) })
    expect(funeralWeek(e)).toBe(5)
    const { fresh } = graveyardPreview(e)
    expect(ids(fresh)).toEqual(WEEK5)
    expect(fresh.length).toBeGreaterThan(6)
  })

  it('shows everyone from earlier weeks as a plain headstone — all of them, never the living', () => {
    const e = evaluateSeason(season(), { now: kickoffFor(5, 48) })
    const { fresh, old } = graveyardPreview(e)
    expect(ids(old)).toEqual(WEEK3)
    expect(ids([...fresh, ...old])).not.toContain('alive')
    expect(ids([...fresh, ...old])).not.toContain('late')
  })

  it('once the next week locks, last week’s dead are just headstones and the new dead get the scene', () => {
    // An hour into week 6: locked, nothing final. `late` never picked, so is out.
    const e = evaluateSeason(season(), { now: kickoffFor(6, 1) })
    expect(funeralWeek(e)).toBe(6)
    const { fresh, old } = graveyardPreview(e)
    expect(ids(fresh)).toEqual(['late'])
    expect(ids(old)).toEqual([...WEEK3, ...WEEK5].sort())
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
    expect(graveyardPreview(e)).toEqual({ fresh: [], old: [] })
  })
})
