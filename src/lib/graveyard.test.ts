import { describe, expect, it } from 'vitest'
import { evaluateSeason } from '@/domain'
import { kickoffFor, scenario } from '@/domain/testing/scenario'
import { deathAct, funeralWeek, graveyardPreview } from './graveyard'

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
  it('keeps the week’s dead fresh when next week’s schedule has not loaded', () => {
    // Week 5 is over and week 6 has no games yet: the stage is still week 5's.
    const snap = season()
    const noWeek6 = { ...snap, games: snap.games.filter((g) => g.week !== 6) }
    const e = evaluateSeason(noWeek6, { now: kickoffFor(5, 48) })
    expect(funeralWeek(e)).toBe(5)
    expect(ids(graveyardPreview(e).fresh)).toEqual(WEEK5)
    expect(deathAct(e)).toBe('dance')
  })

  it('puts every one of the week’s dead among the fresh graves, however many', () => {
    // Tuesday after week 5: its games are done, week 6 is open for picks.
    const e = evaluateSeason(season(), { now: kickoffFor(5, 48) })
    expect(funeralWeek(e)).toBe(5)
    const { fresh } = graveyardPreview(e)
    expect(ids(fresh)).toEqual(WEEK5)
    expect(fresh.length).toBeGreaterThan(6)
  })

  it('keeps everyone from earlier weeks as an old grave — all of them, never the living', () => {
    const e = evaluateSeason(season(), { now: kickoffFor(5, 48) })
    const { fresh, old } = graveyardPreview(e)
    expect(ids(old)).toEqual(WEEK3)
    expect(ids([...fresh, ...old])).not.toContain('alive')
    expect(ids([...fresh, ...old])).not.toContain('late')
  })

  it('once the next week locks, last week’s dead are old graves and the new dead are the fresh ones', () => {
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

describe('deathAct', () => {
  it('dances the week somebody loses a life, eliminated or not', () => {
    // Tuesday after week 5: the eight went out in it.
    expect(deathAct(evaluateSeason(season(), { now: kickoffFor(5, 48) }))).toBe('dance')
    // A life lost without a death is still a life lost.
    const b = scenario()
      .players('alive', 'bruised')
      .game(1, 'GB', 'CHI', { final: 'GB' })
      .game(2, 'KC', 'LV')
      .pick('alive', 1, 'GB')
      .pick('bruised', 1, 'CHI')
    const e = evaluateSeason(b.build(), { now: kickoffFor(1, 48) })
    expect(e.standings.every((s) => s.status === 'alive')).toBe(true)
    expect(deathAct(e)).toBe('dance')
  })

  it('checks his watch in a week nobody lost a life', () => {
    const b = scenario()
      .players('alive', 'bruised')
      .game(1, 'GB', 'CHI', { final: 'GB' })
      .game(2, 'KC', 'LV', { final: 'KC' })
      .game(3, 'BUF', 'MIA')
      .pick('alive', 1, 'GB')
      .pick('bruised', 1, 'CHI')
      .pick('alive', 2, 'KC')
      .pick('bruised', 2, 'KC')
      .pick('alive', 3, 'BUF')
      .pick('bruised', 3, 'BUF')
    // Tuesday after week 2: everybody won it.
    expect(deathAct(evaluateSeason(b.build(), { now: kickoffFor(2, 48) }))).toBe('watch')
    // An hour into week 3: locked, nothing final, so nothing lost yet.
    const live = evaluateSeason(b.build(), { now: kickoffFor(3, 1) })
    expect(funeralWeek(live)).toBe(3)
    expect(deathAct(live)).toBe('watch')
  })
})
