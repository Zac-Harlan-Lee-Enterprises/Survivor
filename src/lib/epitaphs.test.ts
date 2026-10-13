import { describe, expect, it } from 'vitest'
import { evaluateSeason, findStanding, type PlayerStanding } from '@/domain'
import { kickoffFor, scenario } from '@/domain/testing/scenario'
import { EPITAPHS, epitaphFor } from './epitaphs'

const AFTER = kickoffFor(4, 48)

/** Nate Adams, buried by three losses in weeks 1–3 — two weeks before the week his recap was carved for. */
function nateOutInWeek3(): PlayerStanding {
  const snap = scenario()
    // A survivor, or a lone player going out would be crowned co-champion.
    .players('nate-adams', 'survivor')
    .game(1, 'LAC', 'ARI', { final: 'ARI', score: [14, 26] })
    .game(2, 'TB', 'CLE', { final: 'CLE', score: [19, 23] })
    .game(3, 'SF', 'ARI', { final: 'ARI', score: [30, 36] })
    .pick('nate-adams', 1, 'LAC')
    .pick('nate-adams', 2, 'TB')
    .pick('nate-adams', 3, 'SF')
    .pick('survivor', 1, 'ARI')
    .pick('survivor', 2, 'CLE')
    .pick('survivor', 3, 'ARI')
    .build()
  const s = findStanding(evaluateSeason(snap, { now: AFTER }), 'nate-adams')!
  expect(s.status).toBe('eliminated')
  expect(s.eliminatedWeek).toBe(3)
  return s
}

describe('epitaphFor', () => {
  it('is nothing for the living', () => {
    const snap = scenario()
      .players('nate-adams')
      .game(1, 'GB', 'CHI', { final: 'GB' })
      .pick('nate-adams', 1, 'GB')
      .build()
    const s = findStanding(evaluateSeason(snap, { now: AFTER }), 'nate-adams')!
    expect(epitaphFor('nate-adams', 'Nate Adams', s)).toBeNull()
  })

  it('shows the commissioner’s recap when the player went out in the week it was written for', () => {
    const s = { ...nateOutInWeek3(), eliminatedWeek: EPITAPHS['nate-adams']!.writtenAfterWeek }
    expect(epitaphFor('nate-adams', 'Nate Adams', s)).toBe(EPITAPHS['nate-adams']!.recap)
  })

  it('falls back to the record when a corrected result moves the elimination week', () => {
    const text = epitaphFor('nate-adams', 'Nate Adams', nateOutInWeek3())!
    expect(text).not.toBe(EPITAPHS['nate-adams']!.recap)
    expect(text).toContain('left it in week 3')
  })

  it('falls back to the record for a player with no recap yet', () => {
    const text = epitaphFor('nobody-yet', 'Nate Adams', nateOutInWeek3())!
    expect(text).toContain('Rest in peace, Nate')
  })
})
