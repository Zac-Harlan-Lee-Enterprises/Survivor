import { describe, expect, it } from 'vitest'
import type { NFLGame } from '@domain/index'
import { kickoffFor, scenario } from '@domain/testing/scenario'
import { syncActiveSeasons, syncWeek } from './sync'
import { createHarness } from './testing/harness'

const commish = { sub: 'sub-c', email: 'commish@example.com' }

function final(g: NFLGame, home: number, away: number): NFLGame {
  return {
    ...g,
    status: 'final',
    homeScore: home,
    awayScore: away,
    winnerTeamId: home > away ? g.homeTeamId : away > home ? g.awayTeamId : null,
  }
}

describe('result sync', () => {
  it('applies provider finals once; replaying is a no-op; corrections bump versions; commissioner results are locked', async () => {
    const snap = scenario()
      .player('commish', { role: 'commissioner' })
      .players('ann')
      .game(1, 'GB', 'CHI', { kickoff: kickoffFor(1, 0) })
      .game(1, 'KC', 'DEN', { kickoff: kickoffFor(1, 7) })
      .pick('ann', 1, 'GB')
      .build()
    const h = await createHarness(snap, kickoffFor(1, 10))
    const [gb, kc] = snap.games as [NFLGame, NFLGame]
    h.provider.set(1, [final(gb, 24, 17), kc])

    const first = await syncWeek(h.deps, 2026, 1)
    expect(first).toEqual({ changed: 1, skipped: 1, created: 0 })
    const stored = await h.repo.getGame(2026, 1, gb.id)
    expect(stored).toMatchObject({
      status: 'final',
      winnerTeamId: 'GB',
      resultVersion: 1,
      resultSource: 'provider',
    })

    // Duplicate job run: nothing changes, versions stay put.
    const replay = await syncWeek(h.deps, 2026, 1)
    expect(replay).toEqual({ changed: 0, skipped: 2, created: 0 })
    expect((await h.repo.getGame(2026, 1, gb.id))?.resultVersion).toBe(1)

    // Provider corrects the score: one more version.
    h.provider.set(1, [final(gb, 24, 27), kc])
    expect((await syncWeek(h.deps, 2026, 1)).changed).toBe(1)
    expect(await h.repo.getGame(2026, 1, gb.id)).toMatchObject({
      winnerTeamId: 'CHI',
      resultVersion: 2,
    })

    // Commissioner records a manual result; a later provider observation cannot overwrite it.
    const manual = await h.call('POST', `/nfl/games/${gb.id}/manual-result`, {
      ...commish,
      body: { status: 'final', homeScore: 24, awayScore: 20, reason: 'league office ruling' },
    })
    expect(manual.status).toBe(200)
    expect(manual.body).toMatchObject({
      winnerTeamId: 'GB',
      resultSource: 'commissioner',
      resultVersion: 3,
    })
    h.provider.set(1, [final(gb, 24, 27), kc])
    const afterLock = await syncWeek(h.deps, 2026, 1)
    expect(afterLock.changed).toBe(0)
    expect((await h.repo.getGame(2026, 1, gb.id))?.winnerTeamId).toBe('GB')
  })

  it('creates games it has never seen (schedule load) and tolerates provider outages per week', async () => {
    const snap = scenario()
      .player('commish', { role: 'commissioner' })
      .players('ann')
      .game(1, 'GB', 'CHI', { final: 'GB' })
      .pick('ann', 1, 'GB')
      .build()
    const h = await createHarness(snap, kickoffFor(2, -24))
    const newGame: NFLGame = {
      id: '2026-w02-DEN-at-KC',
      seasonYear: 2026,
      week: 2,
      homeTeamId: 'KC',
      awayTeamId: 'DEN',
      kickoffAt: kickoffFor(2),
      status: 'scheduled',
      resultVersion: 0,
      updatedAt: kickoffFor(2, -100),
    }
    h.provider.set(2, [newGame], ['GB'])
    const r = await syncActiveSeasons(h.deps)
    // Current week 2 loads; week 1 recheck fails because the fake provider has no week 1 — reported, not thrown.
    expect(r.find((x) => x.week === 2)?.result).toEqual({ changed: 0, skipped: 1, created: 1 })
    expect(r.find((x) => x.week === 1)?.result).toHaveProperty('error')
    expect(await h.repo.getGame(2026, 2, newGame.id)).toMatchObject({ status: 'scheduled' })
    expect((await h.repo.listWeeks(2026)).find((w) => w.week === 2)?.byeTeamIds).toEqual(['GB'])
  })

  it('exposes sync to the commissioner and returns 503 when the provider is down', async () => {
    const snap = scenario()
      .player('commish', { role: 'commissioner' })
      .players('ann')
      .game(1, 'GB', 'CHI')
      .build()
    const h = await createHarness(snap, kickoffFor(1, -24))
    const down = await h.call('POST', '/nfl/2026/weeks/1/sync', commish)
    expect(down.status).toBe(503)
    expect(down.body.code).toBe('PROVIDER_UNAVAILABLE')
    h.provider.set(1, [final(snap.games[0]!, 10, 3)])
    const ok = await h.call('POST', '/nfl/2026/weeks/1/sync', commish)
    expect(ok.status).toBe(200)
    expect(ok.body.changed).toBe(1)
    expect(
      (await h.call('POST', '/nfl/2026/weeks/1/sync', { sub: 'x', email: 'ann@example.com' }))
        .status,
    ).toBe(403)
  })

  it('lets the commissioner enter a schedule manually when there is no provider', async () => {
    const snap = scenario().player('commish', { role: 'commissioner' }).players('ann').build()
    const h = await createHarness(snap, kickoffFor(1, -24))
    const games = [
      {
        id: '2026-w01-CHI-at-GB',
        seasonYear: 2026,
        week: 1,
        homeTeamId: 'GB',
        awayTeamId: 'CHI',
        kickoffAt: kickoffFor(1),
        status: 'scheduled',
        resultVersion: 0,
        updatedAt: kickoffFor(1, -48),
      },
      {
        id: '2026-w01-DEN-at-KC',
        seasonYear: 2026,
        week: 1,
        homeTeamId: 'KC',
        awayTeamId: 'DEN',
        kickoffAt: kickoffFor(1),
        status: 'scheduled',
        resultVersion: 0,
        updatedAt: kickoffFor(1, -48),
      },
    ]
    expect(
      (await h.call('PUT', '/nfl/2026/weeks/1/games', { ...commish, body: { games } })).body,
    ).toEqual({ saved: 2 })
    expect((await h.call('GET', '/nfl/2026/weeks/1/games')).body).toHaveLength(2)
    expect((await h.call('GET', '/nfl/2026/weeks')).body[0].byeTeamIds).toHaveLength(28)
    const dup = await h.call('PUT', '/nfl/2026/weeks/1/games', {
      ...commish,
      body: { games: [games[0], { ...games[1], awayTeamId: 'CHI' }] },
    })
    expect(dup.status).toBe(400)
  })
})
