import { describe, expect, it } from 'vitest'
import { SeasonSnapshotSchema } from '@/domain'
import fixture from './fixtures/demo-season.json'
import { createDemoLeagueRepository, createDemoPickRepository } from './repositories'
import { DemoStore } from './store'

/**
 * Local commissioner mode reveals every pick immediately; nothing else does.
 *
 * This narrows a real safeguard, so both sides are pinned here. The published
 * demo build is read-only and must still conceal, and connected mode never
 * reaches this adapter at all — it redacts on the server
 * (backend/src/routes/picks.ts), which no browser flag can reach.
 */
const snapshot = SeasonSnapshotSchema.parse(fixture)
const seasonId = snapshot.season.id
// A week whose deadline is still ahead of `now`, so concealment is in force.
const OPEN_WEEK = 2
const BEFORE_DEADLINE = new Date('2026-09-16T12:00:00.000Z')

function ctxFor(opts: { isCommissioner: boolean; revealAllPicks?: boolean }) {
  return {
    store: new DemoStore(snapshot, null),
    clock: { now: () => BEFORE_DEADLINE, isPinned: () => true },
    viewer: () => ({ playerId: 'zac-harlan', isCommissioner: opts.isCommissioner }),
    assetBase: '/',
    revealAllPicks: opts.revealAllPicks,
  }
}

const openWeekPicks = snapshot.picks.filter((p) => p.week === OPEN_WEEK)

describe('local commissioner reveal', () => {
  it('has an open week to test against, or these assertions prove nothing', () => {
    expect(openWeekPicks.length).toBeGreaterThan(0)
  })

  it('shows the commissioner every pick before the deadline when local', async () => {
    const ctx = ctxFor({ isCommissioner: true, revealAllPicks: true })
    const picks = await createDemoPickRepository(ctx).listPicks(seasonId)
    const snap = await createDemoLeagueRepository(ctx).getSeasonSnapshot(seasonId)
    for (const source of [picks, snap.picks]) {
      const week = source.filter((p) => p.week === OPEN_WEEK)
      expect(week).toHaveLength(openWeekPicks.length)
      expect(week.every((p) => p.teamId !== '')).toBe(true)
    }
  })

  it('conceals for the published build, where the flag is off', async () => {
    const ctx = ctxFor({ isCommissioner: true, revealAllPicks: false })
    const picks = await createDemoPickRepository(ctx).listPicks(seasonId)
    const others = picks.filter((p) => p.week === OPEN_WEEK && p.playerId !== 'zac-harlan')
    expect(others).toHaveLength(0)
  })

  it('shows every pick to a signed-out viewer when local', async () => {
    // Signed out is the state a reseed leaves behind, and local demo mode has
    // no other audience — so this is the commissioner looking at their own
    // machine, not a stranger. Requiring a sign-in here made every regenerated
    // fixture look like it had failed to load.
    const ctx = {
      ...ctxFor({ isCommissioner: false, revealAllPicks: true }),
      viewer: () => ({ playerId: null, isCommissioner: false }),
    }
    const picks = await createDemoPickRepository(ctx).listPicks(seasonId)
    expect(picks.filter((p) => p.week === OPEN_WEEK)).toHaveLength(openWeekPicks.length)
  })

  it('still conceals from a signed-out viewer on the published build', async () => {
    const ctx = {
      ...ctxFor({ isCommissioner: false, revealAllPicks: false }),
      viewer: () => ({ playerId: null, isCommissioner: false }),
    }
    const picks = await createDemoPickRepository(ctx).listPicks(seasonId)
    expect(picks.filter((p) => p.week === OPEN_WEEK)).toHaveLength(0)
  })

  it('conceals from a signed-in player even locally — asking what they see is answered honestly', async () => {
    const ctx = ctxFor({ isCommissioner: false, revealAllPicks: true })
    const picks = await createDemoPickRepository(ctx).listPicks(seasonId)
    const others = picks.filter((p) => p.week === OPEN_WEEK && p.playerId !== 'zac-harlan')
    expect(others).toHaveLength(0)
  })
})
