import { useQuery } from '@tanstack/react-query'
import type { GameLine, NFLGame } from '@/domain'
import { useServices } from './hooks'

/** How long a line is trusted before it is read again. Lines move slowly; the page is not a ticker. */
const STALE_MS = 15 * 60_000

/**
 * The point spreads for a week's slate, for anyone reading the league page.
 *
 * Only fetched while some game in the week has yet to kick off: a line is a
 * guide for picking, and nobody is picking a game already under way. A
 * provider without lines, or a feed that will not answer, leaves the slate as
 * it was — no error, no empty chips.
 */
export function useWeekLines(
  seasonYear: number,
  week: number,
  games: NFLGame[],
): Record<string, GameLine> {
  const { nfl } = useServices()
  const upcoming = games.some((g) => g.status === 'scheduled' || g.status === 'postponed')
  const query = useQuery({
    queryKey: ['lines', seasonYear, week] as const,
    queryFn: () => nfl.getLines!(seasonYear, week),
    enabled: upcoming && !!nfl.getLines,
    staleTime: STALE_MS,
    retry: false,
  })
  return query.data ?? {}
}
