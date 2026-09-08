import { createContext, useContext, useEffect, useState } from 'react'
import type { Services, Session } from '@/data'
import type { League, PlayerImage, PlayerProfile, SeasonEvaluation, SeasonSnapshot } from '@/domain'

/** Contexts and hooks live here (a plain .ts file) so component files export only components. */

export const ServicesContext = createContext<Services | null>(null)

export function useServices(): Services {
  const s = useContext(ServicesContext)
  if (!s) throw new Error('useServices must be used inside <ServicesProvider>')
  return s
}

/** Current auth session; re-renders on sign-in/out. */
export function useSession(): Session | null {
  const { auth } = useServices()
  const [session, setSession] = useState<Session | null>(() => auth.getSession())
  useEffect(() => auth.subscribe(setSession), [auth])
  return session
}

/** A ticking "now" from the (possibly pinned) clock. */
export function useNow(intervalMs = 1000): Date {
  const { clock } = useServices()
  const [now, setNow] = useState(() => clock.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(clock.now()), intervalMs)
    const unsubscribe = clock.subscribe?.(() => setNow(clock.now()))
    return () => {
      window.clearInterval(id)
      unsubscribe?.()
    }
  }, [clock, intervalMs])
  return now
}

export interface LeagueContextValue {
  league: League
  snapshot: SeasonSnapshot
  evaluation: SeasonEvaluation
  viewer: { playerId: string | null; isCommissioner: boolean }
  profileOf: (playerId: string) => PlayerProfile
  imageOf: (playerId: string) => PlayerImage | null
}

export const LeagueContext = createContext<LeagueContextValue | null>(null)

export function useLeagueContext(): LeagueContextValue {
  const v = useContext(LeagueContext)
  if (!v) throw new Error('useLeagueContext must be used inside <LeagueProvider>')
  return v
}
