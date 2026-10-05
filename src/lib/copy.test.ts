import { describe, expect, it } from 'vitest'
import { evaluateSeason, findStanding } from '@/domain'
import { kickoffFor, scenario } from '@/domain/testing/scenario'
import { autoEpitaph, causeOfDeath } from './copy'

const AFTER = kickoffFor(4, 48)
const standing = (snap: ReturnType<ReturnType<typeof scenario>['build']>, id: string) => {
  const s = findStanding(evaluateSeason(snap, { now: AFTER }), id)
  if (!s) throw new Error(`no standing for ${id}`)
  return s
}

describe('causeOfDeath', () => {
  it('is null for anyone still alive', () => {
    const snap = scenario()
      .players('ann')
      .game(1, 'GB', 'CHI', { final: 'GB' })
      .pick('ann', 1, 'GB')
      .build()
    expect(causeOfDeath(standing(snap, 'ann'))).toBeNull()
  })

  it('names the team that dealt the final blow, and the earlier losses as complications', () => {
    const snap = scenario()
      .players('ann')
      .game(1, 'LAC', 'ARI', { final: 'ARI' })
      .game(2, 'TB', 'CLE', { final: 'CLE' })
      .game(3, 'WAS', 'SEA', { final: 'WAS' })
      .pick('ann', 1, 'LAC')
      .pick('ann', 2, 'TB')
      .pick('ann', 3, 'SEA')
      .build()
    expect(causeOfDeath(standing(snap, 'ann'))).toBe(
      'Died of the Seahawks, week 3. Complications: the Chargers (wk 1), the Buccaneers (wk 2).',
    )
  })

  it('engraves a missed pick as a missed deadline', () => {
    const snap = scenario()
      .players('ann')
      .game(1, 'LAC', 'ARI', { final: 'ARI' })
      .game(2, 'TB', 'CLE', { final: 'CLE' })
      .game(3, 'WAS', 'SEA', { final: 'WAS' })
      .pick('ann', 1, 'LAC')
      .pick('ann', 3, 'SEA')
      .build()
    expect(causeOfDeath(standing(snap, 'ann'))).toBe(
      'Died of the Seahawks, week 3. Complications: the Chargers (wk 1), a missed deadline (wk 2).',
    )
  })

  it('says so when a tie did it, since a tie costs a life too', () => {
    const snap = scenario()
      .players('ann')
      .game(1, 'LAC', 'ARI', { final: 'ARI' })
      .game(2, 'TB', 'CLE', { final: 'CLE' })
      .game(3, 'WAS', 'SEA', { final: 'tie' })
      .pick('ann', 1, 'LAC')
      .pick('ann', 2, 'TB')
      .pick('ann', 3, 'SEA')
      .build()
    expect(causeOfDeath(standing(snap, 'ann'))).toMatch(/^Died of the Seahawks \(a tie\), week 3\./)
  })

  it('leaves out the weeks that did not cost a life', () => {
    const snap = scenario()
      .players('ann')
      .game(1, 'LAC', 'ARI', { final: 'ARI' })
      .game(2, 'KC', 'MIA', { final: 'KC' })
      .game(3, 'TB', 'CLE', { final: 'CLE' })
      .game(4, 'WAS', 'SEA', { final: 'WAS' })
      .pick('ann', 1, 'LAC')
      .pick('ann', 2, 'KC')
      .pick('ann', 3, 'TB')
      .pick('ann', 4, 'SEA')
      .build()
    const line = causeOfDeath(standing(snap, 'ann'))!
    expect(line).toBe(
      'Died of the Seahawks, week 4. Complications: the Chargers (wk 1), the Buccaneers (wk 3).',
    )
    expect(line).not.toMatch(/Chiefs/)
  })

  it('has no complications for a league that gives one life', () => {
    const snap = scenario()
      .withSettings({ defaultLives: 1 })
      .players('ann')
      .game(1, 'LAC', 'ARI', { final: 'ARI' })
      .pick('ann', 1, 'LAC')
      .build()
    expect(causeOfDeath(standing(snap, 'ann'))).toBe('Died of the Chargers, week 1.')
  })
})

describe('autoEpitaph', () => {
  it('is nothing for the living', () => {
    const snap = scenario()
      .players('ann')
      .game(1, 'GB', 'CHI', { final: 'GB' })
      .pick('ann', 1, 'GB')
      .build()
    expect(autoEpitaph('Ann Example', standing(snap, 'ann'))).toBeNull()
  })

  it('tells the season from the record, week by week, and signs off', () => {
    const snap = scenario()
      .players('ann')
      .game(1, 'LAC', 'ARI', { final: 'ARI', score: [14, 26] })
      .game(2, 'KC', 'MIA', { final: 'KC', score: [24, 10] })
      .game(3, 'TB', 'CLE', { final: 'CLE', score: [19, 23] })
      .game(4, 'WAS', 'SEA', { final: 'WAS', score: [33, 31] })
      .pick('ann', 1, 'LAC')
      .pick('ann', 2, 'KC')
      .pick('ann', 3, 'TB')
      .pick('ann', 4, 'SEA')
      .build()
    const text = autoEpitaph('Ann Example', standing(snap, 'ann'))!
    expect(text).toContain(
      'Ann Example came into the season with three lives and left it in week 4.',
    )
    expect(text).toContain('The win — the Chiefs in week 2 — was the easy part.')
    expect(text).toContain('Week 1: the Chargers at home, beaten by Cardinals, 14–26.')
    expect(text).toContain('Week 3: the Buccaneers at home, beaten by Browns, 19–23.')
    expect(text).toContain(
      'Then, on the last life, the Seahawks on the road, beaten by Commanders, 31–33.',
    )
    expect(text).toMatch(/Rest in peace, Ann\. Twenty-eight teams go unused\.$/)
    expect(text).not.toMatch(/\n/)
  })

  it('notices when the same team comes back to finish the job', () => {
    const snap = scenario()
      .players('ann')
      .game(1, 'LAC', 'ARI', { final: 'ARI' })
      .game(2, 'TB', 'CLE', { final: 'CLE' })
      .game(3, 'SF', 'ARI', { final: 'ARI' })
      .pick('ann', 1, 'LAC')
      .pick('ann', 2, 'TB')
      .pick('ann', 3, 'SF')
      .build()
    expect(autoEpitaph('Ann Example', standing(snap, 'ann'))).toContain(
      'Cardinals had already taken a life in week 1; they came back to finish the job.',
    )
  })

  it('counts a missing pick as the one way to lose without watching', () => {
    const snap = scenario()
      .players('ann')
      .game(1, 'LAC', 'ARI', { final: 'ARI' })
      .game(2, 'TB', 'CLE', { final: 'CLE' })
      .game(3, 'WAS', 'SEA', { final: 'WAS' })
      .pick('ann', 1, 'LAC')
      .pick('ann', 3, 'SEA')
      .build()
    const text = autoEpitaph('Ann Example', standing(snap, 'ann'))!
    expect(text).toContain('Week 2: no pick arrived, which the rules price the same as a loss.')
    expect(text).toContain(
      'One of the lives went to a missing pick, which is the one way to lose without watching.',
    )
    expect(text).toContain('There were no wins. Not one. Consistency is a virtue.')
  })
})
