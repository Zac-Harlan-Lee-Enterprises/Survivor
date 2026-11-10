import { useLeagueContext } from './hooks'
import type { Banner } from '@/lib/champions'

/** This season's banner, once the engine has crowned someone. */
export function useCurrentBanner(): Banner | null {
  const { evaluation, profileOf, snapshot } = useLeagueContext()
  const winners = evaluation.standings.filter(
    (s) => s.status === 'champion' || s.status === 'co-champion',
  )
  if (!winners.length) return null
  return {
    year: snapshot.season.year,
    winners: winners.map((w) => ({
      playerId: w.playerId,
      name: profileOf(w.playerId).displayName,
    })),
  }
}
