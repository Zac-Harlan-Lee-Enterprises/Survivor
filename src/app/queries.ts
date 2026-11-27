import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { evaluateSeason, type SeasonEvaluation, type SeasonSnapshot } from '@/domain'
import type { SubmitPickInput } from '@/data'
import { getConfig } from '@/config/env'
import { msUntilLock } from '@/lib/lock'
import { useNow, useServices, useSession } from './hooks'

export const keys = {
  league: (id: string) => ['league', id] as const,
  snapshot: (seasonId: string, viewer: string) => ['snapshot', seasonId, viewer] as const,
  audit: (leagueId: string) => ['audit', leagueId] as const,
  overrides: (seasonId: string) => ['overrides', seasonId] as const,
  identities: ['demo-identities'] as const,
}

export function useLeague(leagueId = getConfig().defaultLeagueId) {
  const { leagues } = useServices()
  return useQuery({
    queryKey: keys.league(leagueId),
    queryFn: () => leagues.getLeague(leagueId),
    staleTime: 60_000,
  })
}

/** Snapshot is viewer-dependent (pick redaction), so the key includes the actor. */
export function useSnapshot(seasonId: string | undefined) {
  const { leagues } = useServices()
  const session = useSession()
  const viewer = session?.actor.playerId ?? 'anon'
  return useQuery({
    queryKey: keys.snapshot(seasonId ?? '', viewer),
    queryFn: () => leagues.getSeasonSnapshot(seasonId!),
    enabled: !!seasonId,
    staleTime: 15_000,
    refetchInterval: 60_000,
  })
}

/** Evaluation is recomputed when the snapshot or the (minute-level) clock changes. */
export function useEvaluation(snapshot: SeasonSnapshot | undefined): SeasonEvaluation | undefined {
  const now = useNow(30_000)
  const minute = Math.floor(now.getTime() / 30_000)
  const { clock } = useServices()
  // The instant the picks locked, when a timer caught it between two ticks.
  const [lockedAt, setLockedAt] = useState(0)
  const evaluation = useMemo(() => {
    if (!snapshot) return undefined
    return evaluateSeason(snapshot, { now: new Date(Math.max(minute * 30_000, lockedAt)) })
  }, [snapshot, minute, lockedAt])
  // The tick alone can leave the page a minute behind the lock, still offering a
  // pick the server will refuse. So when the lock is near, be there for it.
  useEffect(() => {
    if (!evaluation) return
    const ms = msUntilLock(evaluation, clock.now())
    if (ms == null) return
    const id = window.setTimeout(() => setLockedAt(clock.now().getTime()), ms)
    return () => window.clearTimeout(id)
  }, [evaluation, clock])
  return evaluation
}

export function useInvalidateSeason() {
  const qc = useQueryClient()
  return () =>
    qc.invalidateQueries({
      predicate: (q) =>
        ['snapshot', 'audit', 'overrides', 'league'].includes(String(q.queryKey[0])),
    })
}

export function useSubmitPick() {
  const { picks } = useServices()
  const invalidate = useInvalidateSeason()
  return useMutation({
    mutationFn: (input: SubmitPickInput) => picks.submitPick(input),
    onSuccess: () => invalidate(),
  })
}

export function useAudit(leagueId: string | undefined) {
  const { leagues } = useServices()
  return useQuery({
    queryKey: keys.audit(leagueId ?? ''),
    queryFn: () => leagues.listAuditEvents(leagueId!, 200),
    enabled: !!leagueId,
  })
}

export function useOverrides(seasonId: string | undefined) {
  const { leagues } = useServices()
  return useQuery({
    queryKey: keys.overrides(seasonId ?? ''),
    queryFn: () => leagues.listOverrides(seasonId!),
    enabled: !!seasonId,
  })
}

export function useDemoIdentities() {
  const { auth } = useServices()
  return useQuery({
    queryKey: keys.identities,
    queryFn: () => (auth.listDemoIdentities ? auth.listDemoIdentities() : Promise.resolve([])),
    enabled: auth.kind === 'demo',
  })
}
