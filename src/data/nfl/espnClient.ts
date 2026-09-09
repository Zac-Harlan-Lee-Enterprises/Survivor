import { espnWeekUrl, parseScoreboard, type EspnScoreboard, type ParsedScoreboard } from '@/domain'
import { DataError } from '../interfaces'

/**
 * Browser-side ESPN scoreboard client.
 *
 * The static site can call this endpoint directly: it answers with
 * `access-control-allow-origin: *` and needs no key, so live scores work on
 * GitHub Pages with no backend at all. Parsing is the domain's job
 * (src/domain/nfl/espn.ts), shared with the Lambda sync.
 *
 * NOTE: this is one of only two modules allowed to call fetch() — see
 * tests/architecture/layers.test.ts. Everything network-shaped stays here so
 * failures map to one error type and can be stubbed in tests.
 */
export interface EspnClient {
  fetchWeek(seasonYear: number, week: number): Promise<ParsedScoreboard>
}

export function createEspnClient(
  fetchImpl: typeof fetch = fetch,
  now: () => Date = () => new Date(),
): EspnClient {
  return {
    async fetchWeek(seasonYear, week) {
      let res: Response
      try {
        res = await fetchImpl(espnWeekUrl(seasonYear, week), {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        })
      } catch {
        throw new DataError(
          'PROVIDER_UNREACHABLE',
          'Could not reach the live score feed. Check your connection, or enter results by hand.',
          { status: 0 },
        )
      }
      if (!res.ok) {
        throw new DataError(
          'PROVIDER_ERROR',
          `The live score feed answered ${res.status}. Try again shortly, or enter results by hand.`,
          { status: res.status },
        )
      }
      let data: EspnScoreboard
      try {
        data = (await res.json()) as EspnScoreboard
      } catch {
        throw new DataError('PROVIDER_BAD_PAYLOAD', 'The live score feed returned unreadable data.')
      }
      try {
        return parseScoreboard(data, now().toISOString(), { seasonYear, week })
      } catch (err) {
        throw new DataError(
          'PROVIDER_BAD_PAYLOAD',
          err instanceof Error ? err.message : 'The live score feed returned an unexpected shape.',
        )
      }
    },
  }
}
