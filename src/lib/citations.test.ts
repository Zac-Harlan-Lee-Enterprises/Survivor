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
  it('tells the champion’s season from the record, every line of it true', () => {
    const { evaluation, ann } = season()
    const text = autoCitation('Ann Example', ann, evaluation.standings)
    expect(text).toContain('Ann Example outlasted three of us. Every single one.')
    expect(text).toContain('Two wins in three weeks, and finished with one of two lives.')
    expect(text).toContain('The closest call was week 1: the Packers at home, 31–30. One point.')
    expect(text).toContain(
      'In week 1 Ann was the only one of us on the Packers, and the Packers won.',
    )
    expect(text).toContain(
      'In week 1, three of us lost a life on the Bears; Ann was over on the Packers, not looking.',
    )
    expect(text).toContain('The scars: Buccaneers in week 2. Ann kept walking.')
    expect(text.endsWith('Long live Ann.')).toBe(true)
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
      'Long live Ann.',
    )
  })
})
