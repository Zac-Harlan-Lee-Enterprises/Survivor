import { espnWeekUrl, parseScoreboard, type EspnScoreboard } from '@domain/index'
import type { ExternalNFLProvider } from './types'

/**
 * ESPN public scoreboard feed (no API key).
 *
 * The PARSER lives in the domain (src/domain/nfl/espn.ts) so the browser and
 * this Lambda interpret the payload identically. Only the fetch lives here.
 *
 * The endpoint is UNOFFICIAL and may change without notice; the commissioner's
 * manual entry keeps the league running if it disappears.
 */
export function createEspnProvider(
  fetchImpl: typeof fetch = fetch,
  now: () => Date = () => new Date(),
): ExternalNFLProvider {
  return {
    name: 'espn-public-scoreboard',
    async fetchWeek(seasonYear, week) {
      const res = await fetchImpl(espnWeekUrl(seasonYear, week), {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) throw new Error(`ESPN scoreboard responded ${res.status}`)
      const data = (await res.json()) as EspnScoreboard
      const parsed = parseScoreboard(data, now().toISOString(), { seasonYear, week })
      return { games: parsed.games, week: parsed.week }
    },
  }
}
