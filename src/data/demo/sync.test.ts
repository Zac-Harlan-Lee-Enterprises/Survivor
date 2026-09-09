import { beforeEach, describe, expect, it, vi } from 'vitest'
import { evaluateSeason, findStanding, type NFLGame, type SeasonSnapshot } from '@/domain'
import { SeasonSnapshotSchema } from '@/domain'
import fixture from './fixtures/demo-season.json'
import type { EspnClient } from '../nfl/espnClient'
import { createDemoNFLProvider } from './repositories'
import { DemoStore } from './store'

/**
 * Live-score sync in demo mode: replaces the placeholder schedule with the
 * provider's real slate, re-links picks, and stays idempotent on repeat runs.
 */

const SEASON = 2026
const WEEK = 1
const OBSERVED = new Date('2026-09-13T21:00:00.000Z')

function realGame(home: string, away: string, over: Partial<NFLGame> = {}): NFLGame {
  return {
    id: `2026-w01-${away}-at-${home}`,
    seasonYear: SEASON,
    week: WEEK,
    homeTeamId: home,
    awayTeamId: away,
    kickoffAt: '2026-09-13T17:00:00.000Z',
    status: 'scheduled',
    resultVersion: 0,
    resultSource: 'provider',
    updatedAt: OBSERVED.toISOString(),
    ...over,
  }
}

/** The real week 1 pairings for the teams this league picked. */
const REAL_SLATE = [
  realGame('JAX', 'CLE'),
  realGame('IND', 'BAL'),
  realGame('DET', 'NO'),
  realGame('LAC', 'ARI'),
  realGame('SEA', 'NE'),
]

function harness(games: NFLGame[]) {
  const snapshot = SeasonSnapshotSchema.parse(fixture) as SeasonSnapshot
  const store = new DemoStore(snapshot, null)
  const clock = { now: () => OBSERVED, isPinned: () => true }
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
    clock,
    viewer: () => ({ playerId: 'zac-harlan', isCommissioner: true }),
    assetBase: '/',
  }
  return { store, provider: createDemoNFLProvider(ctx, espn), espn, snapshot }
}

describe('demo live-score sync', () => {
  let h: ReturnType<typeof harness>
  beforeEach(() => {
    h = harness(REAL_SLATE)
  })

  it('replaces the placeholder slate with the provider schedule', async () => {
    const before = h.store.snapshot().weeks.find((w) => w.week === WEEK)
    expect(before?.source).toBe('synthetic')

    const r = await h.provider.syncResults!(SEASON, WEEK)
    expect(r.created).toBe(REAL_SLATE.length)
    const after = h.store.snapshot()
    expect(after.weeks.find((w) => w.week === WEEK)?.source).toBe('provider')
    const week1 = after.games.filter((g) => g.week === WEEK)
    expect(week1).toHaveLength(REAL_SLATE.length)
    expect(week1.map((g) => g.id).sort()).toEqual(REAL_SLATE.map((g) => g.id).sort())
  })

  it('re-links every pick to the real game so none is orphaned', async () => {
    const r = await h.provider.syncResults!(SEASON, WEEK)
    expect(r.orphanedPicks).toEqual([])
    expect(r.relinkedPicks).toBe(9)
    const snap = h.store.snapshot()
    const ids = new Set(snap.games.filter((g) => g.week === WEEK).map((g) => g.id))
    for (const pick of snap.picks.filter((p) => p.week === WEEK)) {
      expect(ids.has(pick.gameId), `${pick.playerId} -> ${pick.gameId}`).toBe(true)
    }
    // Maya rode the Jaguars; her pick must point at the real CLE @ JAX game.
    expect(snap.picks.find((p) => p.playerId === 'maya-israel')?.gameId).toBe('2026-w01-CLE-at-JAX')
  })

  it('reports picks whose team is absent from the provider slate instead of dropping them', async () => {
    const partial = harness(REAL_SLATE.filter((g) => g.homeTeamId !== 'SEA'))
    const r = await partial.provider.syncResults!(SEASON, WEEK)
    expect(r.orphanedPicks).toEqual(['Sheila Acker (SEA)'])
  })

  it('applies live scores and finals, and is idempotent on a repeat sync', async () => {
    const live = [
      realGame('DET', 'NO', { status: 'in_progress', homeScore: 14, awayScore: 10 }),
      realGame('LAC', 'ARI', {
        status: 'final',
        homeScore: 27,
        awayScore: 20,
        winnerTeamId: 'LAC',
      }),
      ...REAL_SLATE.filter((g) => !['DET', 'LAC'].includes(g.homeTeamId)),
    ]
    const scored = harness(live)
    const first = await scored.provider.syncResults!(SEASON, WEEK)
    expect(first.changed).toBe(2)

    const stored = scored.store.snapshot().games
    expect(stored.find((g) => g.id === '2026-w01-ARI-at-LAC')).toMatchObject({
      status: 'final',
      winnerTeamId: 'LAC',
      resultVersion: 1,
    })

    // Chargers backers survive; the Lions game is still pending.
    const ev = evaluateSeason(scored.store.snapshot(), { now: OBSERVED })
    expect(findStanding(ev, 'zac-harlan')?.livesRemaining).toBe(3)
    expect(findStanding(ev, 'dave-johnson')?.currentOutcome).toBe('pending')

    const second = await scored.provider.syncResults!(SEASON, WEEK)
    expect(second.changed).toBe(0)
    expect(second.created).toBe(0)
    expect(second.skipped).toBe(live.length)
    expect(
      scored.store.snapshot().games.find((g) => g.id === '2026-w01-ARI-at-LAC')?.resultVersion,
    ).toBe(1)
  })

  it('never overwrites a result the commissioner entered by hand', async () => {
    await h.provider.syncResults!(SEASON, WEEK)
    h.store.update((d) => {
      const g = d.snapshot.games.find((x) => x.id === '2026-w01-ARI-at-LAC')!
      g.status = 'final'
      g.homeScore = 30
      g.awayScore = 3
      g.winnerTeamId = 'LAC'
      g.resultSource = 'commissioner'
      g.resultVersion = 5
    })
    const contradicting = harness(REAL_SLATE)
    // Point the second harness at the same store, then feed a different final.
    const provider = createDemoNFLProvider(
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
          games: [
            realGame('LAC', 'ARI', {
              status: 'final',
              homeScore: 10,
              awayScore: 24,
              winnerTeamId: 'ARI',
            }),
          ],
          skipped: 0,
        }),
      },
    )
    void contradicting
    await provider.syncResults!(SEASON, WEEK)
    const g = h.store.snapshot().games.find((x) => x.id === '2026-w01-ARI-at-LAC')!
    expect(g.winnerTeamId, 'commissioner result must win').toBe('LAC')
    expect(g.homeScore).toBe(30)
  })

  it('surfaces provider failures instead of corrupting the schedule', async () => {
    const failing = harness(REAL_SLATE)
    failing.espn.fetchWeek = vi.fn(async () => {
      throw new Error('offline')
    })
    await expect(failing.provider.syncResults!(SEASON, WEEK)).rejects.toThrow(/offline/)
    expect(failing.store.snapshot().weeks.find((w) => w.week === WEEK)?.source).toBe('synthetic')
  })
})
