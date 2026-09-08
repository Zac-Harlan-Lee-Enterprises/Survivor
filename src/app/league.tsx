import type { ReactNode } from 'react'
import { ErrorState, LoadingState } from '@/components/states'
import { LeagueContext, useSession, type LeagueContextValue } from './hooks'
import { useEvaluation, useLeague, useSnapshot } from './queries'

export function LeagueProvider({ children }: { children: ReactNode }) {
  const leagueQuery = useLeague()
  const snapshotQuery = useSnapshot(leagueQuery.data?.currentSeasonId)
  const evaluation = useEvaluation(snapshotQuery.data)
  const session = useSession()

  if (leagueQuery.isError)
    return <ErrorState error={leagueQuery.error} retry={() => void leagueQuery.refetch()} />
  if (snapshotQuery.isError)
    return <ErrorState error={snapshotQuery.error} retry={() => void snapshotQuery.refetch()} />
  if (!leagueQuery.data || !snapshotQuery.data || !evaluation)
    return <LoadingState label="Loading the league" />

  const snapshot = snapshotQuery.data
  const profiles = new Map(snapshot.profiles.map((p) => [p.playerId, p]))
  const images = new Map(snapshot.images.map((i) => [i.playerId, i]))
  const value: LeagueContextValue = {
    league: leagueQuery.data,
    snapshot,
    evaluation,
    viewer: {
      playerId: session?.actor.playerId ?? null,
      isCommissioner: session?.actor.isCommissioner ?? false,
    },
    profileOf: (id) => profiles.get(id) ?? { playerId: id, displayName: id, imageId: null },
    imageOf: (id) => images.get(id) ?? null,
  }
  return <LeagueContext.Provider value={value}>{children}</LeagueContext.Provider>
}
