import { describe, expect, it, vi } from 'vitest'
import { DataError } from '../interfaces'
import { createEspnClient } from './espnClient'

/**
 * The live browser call cannot be exercised in CI (no outbound network), so the
 * request shape and every failure path are pinned here with a stubbed fetch.
 * The parser itself is covered against a real captured payload in
 * src/domain/nfl/espn.test.ts.
 */
const NOW = () => new Date('2026-09-13T21:00:00.000Z')

const payload = {
  season: { year: 2026, type: 2 },
  week: { number: 1 },
  events: [
    {
      date: '2026-09-13T17:00Z',
      status: { type: { name: 'STATUS_FINAL' } },
      competitions: [
        {
          date: '2026-09-13T17:00Z',
          status: { type: { name: 'STATUS_FINAL' } },
          competitors: [
            { homeAway: 'home', score: '27', team: { abbreviation: 'JAX' } },
            { homeAway: 'away', score: '20', team: { abbreviation: 'CLE' } },
          ],
        },
      ],
    },
  ],
}

const okResponse = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response

describe('createEspnClient', () => {
  it('requests the right week and returns parsed games', async () => {
    const fetchImpl = vi.fn(async () => okResponse(payload)) as unknown as typeof fetch
    const parsed = await createEspnClient(fetchImpl, NOW).fetchWeek(2026, 1)
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(url).toBe(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2026&seasontype=2&week=1',
    )
    expect((init as RequestInit).cache).toBe('no-store')
    expect(parsed.games).toHaveLength(1)
    expect(parsed.games[0]).toMatchObject({ id: '2026-w01-CLE-at-JAX', winnerTeamId: 'JAX' })
  })

  it('maps an unreachable network to an actionable error', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    await expect(createEspnClient(fetchImpl, NOW).fetchWeek(2026, 1)).rejects.toMatchObject({
      code: 'PROVIDER_UNREACHABLE',
      status: 0,
    })
    await expect(createEspnClient(fetchImpl, NOW).fetchWeek(2026, 1)).rejects.toThrow(
      /enter results by hand/i,
    )
  })

  it('maps an HTTP error to a retryable message carrying the status', async () => {
    const fetchImpl = vi.fn(
      async () => ({ ok: false, status: 503, json: async () => ({}) }) as unknown as Response,
    ) as unknown as typeof fetch
    const err = await createEspnClient(fetchImpl, NOW)
      .fetchWeek(2026, 1)
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(DataError)
    expect(err).toMatchObject({ code: 'PROVIDER_ERROR', status: 503 })
  })

  it('reports unreadable JSON rather than throwing a raw parse error', async () => {
    const fetchImpl = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => {
            throw new SyntaxError('Unexpected token <')
          },
        }) as unknown as Response,
    ) as unknown as typeof fetch
    await expect(createEspnClient(fetchImpl, NOW).fetchWeek(2026, 1)).rejects.toMatchObject({
      code: 'PROVIDER_BAD_PAYLOAD',
    })
  })

  it('falls back to the requested week when the payload omits it', async () => {
    const fetchImpl = vi.fn(async () =>
      okResponse({ events: payload.events }),
    ) as unknown as typeof fetch
    const parsed = await createEspnClient(fetchImpl, NOW).fetchWeek(2026, 7)
    expect(parsed.week.week).toBe(7)
    expect(parsed.games[0]?.id).toBe('2026-w07-CLE-at-JAX')
  })
})
