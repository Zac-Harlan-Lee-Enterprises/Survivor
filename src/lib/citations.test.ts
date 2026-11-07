import { afterEach, describe, expect, it } from 'vitest'
import { evaluateSeason, findStanding } from '@/domain'
import { kickoffFor, scenario } from '@/domain/testing/scenario'
import { CITATIONS, autoCitation, citationFor } from './citations'

/**
 * Ann wins the league in week 3 on two lives: alone on Green Bay by a point
 * in week 1 while the other three lose on Chicago, burned by Tampa Bay in
 * week 2, and still standing when the rest go out on the Rams in week 3.
 */
function season() {
  const snap = scenario()
    .withSettings({ defaultLives: 2 })
    .players('ann', 'bob', 'cat', 'dan')
    .game(1, 'GB', 'CHI', { final: 'GB', score: [31, 30] })
    .game(2, 'TB', 'CLE', { final: 'CLE', score: [19, 23] })
    .game(2, 'KC', 'MIA', { final: 'KC', score: [24, 10] })
    .game(3, 'SF', 'ARI', { final: 'SF', score: [30, 20] })
    .game(3, 'LAR', 'SEA', { final: 'SEA', score: [16, 18] })
    .pick('ann', 1, 'GB')
    .pick('ann', 2, 'TB')
    .pick('ann', 3, 'SF')
    .pick('bob', 1, 'CHI')
    .pick('cat', 1, 'CHI')
    .pick('dan', 1, 'CHI')
    .pick('bob', 2, 'KC')
    .pick('cat', 2, 'KC')
    .pick('dan', 2, 'KC')
    .pick('bob', 3, 'LAR')
    .pick('cat', 3, 'LAR')
    .pick('dan', 3, 'LAR')
    .build()
  const evaluation = evaluateSeason(snap, { now: kickoffFor(3, 48) })
  const ann = findStanding(evaluation, 'ann')!
  expect(ann.status).toBe('champion')
  return { evaluation, ann }
}

describe('autoCitation', () => {
  it('proclaims the champion’s season from the record, every claim in it true', () => {
    const { evaluation, ann } = season()
    const text = autoCitation('Ann Example', ann, evaluation.standings, 'The Sunday Survivors')
    for (const claim of [
      'Ann Example is the champion of The Sunday Survivors.',
      'Ann outlasted three of us and left every single one of them standing in the rain.',
      'The graveyard holds three headstones, and Ann walked past every one of them',
      'Two wins in three weeks, finishing on one of two lives',
      'The road to glory ran through the Packers, the Buccaneers and the 49ers: three franchises',
      'The closest call was week 1: the Packers at home, 31–30. One point.',
      'In week 1 Ann took the Packers when not one other person in the league would touch them. The Packers won.',
      'In week 1, three of us stampeded onto the Bears and lost a life together',
      'Ann was over on the Packers, not even looking.',
      'The Buccaneers in week 2 took a life.',
    ])
      expect(text).toContain(claim)
    expect(text.startsWith('Hear ye, hear ye.')).toBe(true)
    expect(
      text.endsWith('All hail Ann: Last One Standing, Breaker of Spirits, First of Their Name.'),
    ).toBe(true)
  })

  it('names the commissioner among the beaten when the commissioner played', () => {
    const { evaluation, ann } = season()
    const standings = evaluation.standings.map((s) =>
      s.playerId === 'bob'
        ? { ...s, membership: { ...s.membership, role: 'commissioner' as const } }
        : s,
    )
    expect(autoCitation('Ann Example', ann, standings)).toContain(
      'Ann outlasted three of us, the commissioner among them, and left',
    )
  })

  it('never claims a close call or a lone stand the record does not hold', () => {
    const snap = scenario()
      .players('ann', 'bob')
      .game(1, 'KC', 'MIA', { final: 'KC', score: [30, 10] })
      .game(1, 'LAR', 'SEA', { final: 'SEA', score: [10, 30] })
      .pick('ann', 1, 'KC')
      .pick('bob', 1, 'LAR')
      .build()
    const evaluation = evaluateSeason(snap, { now: kickoffFor(1, 48) })
    const ann = findStanding(evaluation, 'ann')!
    const text = autoCitation('Ann Example', ann, evaluation.standings)
    expect(text).not.toContain('closest call')
    expect(text).not.toContain('not one other person')
  })
})

describe('citationFor', () => {
  afterEach(() => {
    delete CITATIONS['ann']
  })

  it('is nothing for anyone not wearing the crown', () => {
    const { evaluation } = season()
    const bob = findStanding(evaluation, 'bob')!
    expect(citationFor('bob', 'Bob', bob, evaluation.standings, 3)).toBeNull()
  })

  it('shows the commissioner’s own words when written for the week it was decided', () => {
    const { evaluation, ann } = season()
    CITATIONS['ann'] = { recap: 'All hail Ann.', writtenAfterWeek: 3 }
    expect(citationFor('ann', 'Ann Example', ann, evaluation.standings, 3)).toBe('All hail Ann.')
  })

  it('falls back to the record when a corrected result moves the deciding week', () => {
    const { evaluation, ann } = season()
    CITATIONS['ann'] = { recap: 'All hail Ann.', writtenAfterWeek: 2 }
    expect(citationFor('ann', 'Ann Example', ann, evaluation.standings, 3)).toContain(
      'All hail Ann',
    )
  })
})
