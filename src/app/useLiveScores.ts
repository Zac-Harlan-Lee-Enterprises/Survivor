import { useCallback, useEffect, useRef, useState } from 'react'
import { weekIsLive, type NFLGame } from '@/domain'
import { useNow, useServices } from './hooks'
import { useInvalidateSeason } from './queries'

/** How often to ask the provider while a week is actually being played. */
const POLL_MS = 45_000
/** After a failure, wait longer before trying again. */
const BACKOFF_MS = 3 * 60_000

export interface LiveScores {
  /** Game id → where it is up to right now ("3rd 5:21"), when the provider says. */
  detail: Record<string, string>
  /** True while a game in this set is under way. */
  live: boolean
}

/**
 * Keeps scores fresh while games are being played.
 *
 * This is the whole league's refresh, not the commissioner's. It used to live
 * inside the Results tab, which is wrapped in `<Writable>` and therefore does
 * not exist on the published site — so on GitHub Pages the scores never moved,
 * despite everything underneath them working. Anyone reading the league page
 * now drives the same sync.
 *
 * Polling is decided by kickoff times, not by stored status. The old condition
 * waited for a game to be `in_progress`, which is precisely the fact the fetch
 * exists to discover, so it could never become true on its own.
 *
 * Writes go through the provider port, so this behaves the same in demo mode
 * (straight to ESPN, stored in this browser) and connected mode (the API).
 * Failures are silent: a missed poll is invisible, and the tiles keep showing
 * the last thing known to be true.
 */
export function useLiveScores(seasonYear: number, week: number, games: NFLGame[]): LiveScores {
  const { nfl } = useServices()
  const invalidate = useInvalidateSeason()
  // A minute-level clock is enough to notice a kickoff, and re-renders rarely.
  const now = useNow(30_000)
  const live = weekIsLive(games, now)
  const [detail, setDetail] = useState<Record<string, string>>({})

  const poll = useCallback(async () => {
    if (!nfl.syncResults) return
    const summary = await nfl.syncResults(seasonYear, week)
    setDetail(summary.liveDetail ?? {})
    if (summary.changed > 0 || summary.created > 0) invalidate()
  }, [nfl, seasonYear, week, invalidate])

  // Refs are written in an effect, never during render: the interval below must
  // call the latest poll without being torn down and rebuilt on every render.
  const pollRef = useRef(poll)
  useEffect(() => {
    pollRef.current = poll
  })

  useEffect(() => {
    if (!live || !nfl.syncResults) return
    let cancelled = false
    let timer = 0

    const run = async () => {
      let wait = POLL_MS
      try {
        await pollRef.current()
      } catch {
        // The feed is unofficial and the viewer may simply be offline. Back off
        // and try again; there is nothing here for a reader to act on.
        wait = BACKOFF_MS
      }
      if (!cancelled) timer = window.setTimeout(() => void run(), wait)
    }

    // A league page sits open all Sunday. Polling a tab nobody is looking at
    // burns a phone battery to update pixels no one can see.
    const onVisibility = () => {
      if (document.hidden) {
        window.clearTimeout(timer)
      } else {
        window.clearTimeout(timer)
        void run()
      }
    }

    if (!document.hidden) void run()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [live, nfl, seasonYear, week])

  // A stale clock is worse than none, so the detail is derived rather than
  // stored: once nothing is live it simply stops being returned, instead of
  // leaving "3rd 5:21" frozen under a finished game.
  return { detail: live ? detail : {}, live }
}
