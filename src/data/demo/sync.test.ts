import { beforeEach, describe, expect, it, vi } from 'vitest'
import { evaluateSeason, findStanding, SeasonSnapshotSchema, type NFLGame } from '@/domain'
import fixture from './fixtures/demo-season.json'
import type { EspnClient } from '../nfl/espnClient'
import { createDemoNFLProvider } from './repositories'
import { DemoStore } from './store'

/**
 * Live-score sync in demo mode. Two starting points matter:
 *   - an established league whose schedule already came from the provider
 *     (what the app ships), where syncing only moves scores; and
 *   - a league still on a placeholder schedule, where the first sync replaces
 *     the slate and must re-link picks to the real games.
 */

const SEASON = 2026
const WEEK = 1
const OBSERVED = new Date('2026-09-13T21:00:00.000Z')
const base = () => SeasonSnapshotSchema.parse(fixture)

/** The real week 1 games the seeded picks depend on. */
const realWeek1 = () => base().games.filter((g) => g.week === WEEK)

function withScores(games: NFLGame[], edits: Record<string, Partial<NFLGame>>): NFLGame[] {
  return games.map((g) => (edits[g.id] ? { ...g, ...edits[g.id] } : g))
}

function harness(games: NFLGame[], snapshot = base()) {
  const store = new DemoStore(snapshot, null)
  const espn: EspnClient = {
    fetchWeek: vi.fn(async () => ({
      seasonYear: SEASON,
      week: {
        seasonYear: SEASON,
        week: WEEK,
        label: 'Week 1',
        byeTeamIds: [],
        source: 'provider' as const,
      },
      games,
      skipped: 0,
    })),
  }
  const ctx = {
    store,
    clock: { now: () => OBSERVED, isPinned: () => true },
    viewer: () => ({ playerId: 'zac-harlan', isCommissioner: true }),
    assetBase: '/',
  }
  return { store, provider: createDemoNFLProvider(ctx, espn), espn }
}

describe('demo live-score sync — established league (ships with the real schedule)', () => {
  let h: ReturnType<typeof harness>
  beforeEach(() => {
    h = harness(realWeek1())
  })

  it('adds nothing and changes nothing when the provider repeats what we hold', async () => {
    const r = await h.provider.syncResults!(SEASON, WEEK)
    expect(r.created).toBe(0)
    expect(r.changed).toBe(0)
    expect(r.relinkedPicks).toBe(0)
    expect(r.orphanedPicks).toEqual([])
    expect(r.skipped).toBe(realWeek1().length)
  })

  it('applies live scores and finals, then is idempotent on a repeat sync', async () => {
    const live = withScores(realWeek1(), {
      '2026-w01-NO-at-DET': { status: 'in_progress', homeScore: 14, awayScore: 10 },
      '2026-w01-ARI-at-LAC': {
        status: 'final',
        homeScore: 27,
        awayScore: 20,
        winnerTeamId: 'LAC',
      },
    })
    const scored = harness(live)
    const first = await scored.provider.syncResults!(SEASON, WEEK)
    expect(first.changed).toBe(2)

    expect(scored.store.snapshot().games.find((g) => g.id === '2026-w01-ARI-at-LAC')).toMatchObject(
      {
        status: 'final',
        winnerTeamId: 'LAC',
        resultVersion: 1,
      },
    )

    // All three Chargers backers survive; the Lions game is still pending.
    const ev = evaluateSeason(scored.store.snapshot(), { now: OBSERVED })
    for (const id of ['zac-harlan', 'nate-adams', 'stacey-markendorff']) {
      expect(findStanding(ev, id)?.livesRemaining, id).toBe(3)
      expect(findStanding(ev, id)?.currentOutcome, id).toBe('win')
    }
    expect(findStanding(ev, 'dave-johnson')?.currentOutcome).toBe('pending')

    const second = await scored.provider.syncResults!(SEASON, WEEK)
    expect(second.changed).toBe(0)
    expect(second.skipped).toBe(live.length)
    expect(
      scored.store.snapshot().games.find((g) => g.id === '2026-w01-ARI-at-LAC')?.resultVersion,
    ).toBe(1)
  })

  it('costs a life when a picked team loses, without touching anyone else', async () => {
    const live = withScores(realWeek1(), {
      '2026-w01-NO-at-DET': { status: 'final', homeScore: 13, awayScore: 27, winnerTeamId: 'NO' },
    })
    const scored = harness(live)
    await scored.provider.syncResults!(SEASON, WEEK)
    const ev = evaluateSeason(scored.store.snapshot(), { now: OBSERVED })
    // Dave Johnson and James Parker both rode the Lions.
    expect(findStanding(ev, 'dave-johnson')?.livesRemaining).toBe(2)
    expect(findStanding(ev, 'james-parker')?.livesRemaining).toBe(2)
    expect(findStanding(ev, 'sheila-acker')?.livesRemaining).toBe(3)
  })

  it('never overwrites a result the commissioner entered by hand', async () => {
    h.store.update((d) => {
      const g = d.snapshot.games.find((x) => x.id === '2026-w01-ARI-at-LAC')!
      Object.assign(g, {
        status: 'final',
        homeScore: 30,
        awayScore: 3,
        winnerTeamId: 'LAC',
        resultSource: 'commissioner',
        resultVersion: 5,
      })
    })
    const contradicting = withScores(realWeek1(), {
      '2026-w01-ARI-at-LAC': { status: 'final', homeScore: 10, awayScore: 24, winnerTeamId: 'ARI' },
    })
    const provider = harness(contradicting, h.store.snapshot()).provider
    // Point the new provider at the same store as the edit above.
    const same = createDemoNFLProvider(
      {
        store: h.store,
        clock: { now: () => OBSERVED },
        viewer: () => ({ playerId: 'zac-harlan', isCommissioner: true }),
        assetBase: '/',
      },
      {
        fetchWeek: async () => ({
          seasonYear: SEASON,
          week: {
            seasonYear: SEASON,
            week: WEEK,
            label: 'Week 1',
            byeTeamIds: [],
            source: 'provider' as const,
          },
          games: contradicting,
          skipped: 0,
        }),
      },
    )
    void provider
    await same.syncResults!(SEASON, WEEK)
    const g = h.store.snapshot().games.find((x) => x.id === '2026-w01-ARI-at-LAC')!
    expect(g.winnerTeamId, 'commissioner result must win').toBe('LAC')
    expect(g.homeScore).toBe(30)
  })

  it('surfaces provider failures without corrupting the schedule', async () => {
    h.espn.fetchWeek = vi.fn(async () => {
      throw new Error('offline')
    })
    const before = h.store.snapshot().games.filter((g) => g.week === WEEK).length
    await expect(h.provider.syncResults!(SEASON, WEEK)).rejects.toThrow(/offline/)
    expect(h.store.snapshot().games.filter((g) => g.week === WEEK)).toHaveLength(before)
  })
})

describe('demo live-score sync — league still on a placeholder schedule', () => {
  /** A league seeded before the real fixtures were available. */
  function placeholderSnapshot() {
    const snap = base()
    snap.weeks = snap.weeks.map((w) => (w.week === WEEK ? { ...w, source: 'synthetic' } : w))
    // Replace week 1 with invented matchups carrying different ids.
    snap.games = [
      ...snap.games.filter((g) => g.week !== WEEK),
      ...realWeek1().map((g, i) => ({
        ...g,
        id: `placeholder-${i}`,
        kickoffAt: '2026-09-13T17:00:00.000Z',
      })),
    ]
    snap.picks = snap.picks.map((p) =>
      p.week === WEEK ? { ...p, gameId: `placeholder-stale-${p.playerId}` } : p,
    )
    return snap
  }

  it('replaces the placeholder slate and re-links every pick to the real game', async () => {
    const h = harness(realWeek1(), placeholderSnapshot())
    expect(h.store.snapshot().weeks.find((w) => w.week === WEEK)?.source).toBe('synthetic')

    const r = await h.provider.syncResults!(SEASON, WEEK)
    expect(r.created).toBe(realWeek1().length)
    expect(r.relinkedPicks).toBe(9)
    expect(r.orphanedPicks).toEqual([])

    const snap = h.store.snapshot()
    expect(snap.weeks.find((w) => w.week === WEEK)?.source).toBe('provider')
    const ids = new Set(snap.games.filter((g) => g.week === WEEK).map((g) => g.id))
    expect(ids.has('placeholder-0')).toBe(false)
    for (const pick of snap.picks.filter((p) => p.week === WEEK)) {
      expect(ids.has(pick.gameId), `${pick.playerId} -> ${pick.gameId}`).toBe(true)
    }
    expect(snap.picks.find((p) => p.playerId === 'maya-israel')?.gameId).toBe('2026-w01-CLE-at-JAX')
  })

  it('reports a pick whose team is absent from the provider slate instead of dropping it', async () => {
    const partial = realWeek1().filter((g) => g.homeTeamId !== 'SEA' && g.awayTeamId !== 'SEA')
    const h = harness(partial, placeholderSnapshot())
    const r = await h.provider.syncResults!(SEASON, WEEK)
    expect(r.orphanedPicks).toEqual(['Sheila Acker (SEA)'])
  })
})
