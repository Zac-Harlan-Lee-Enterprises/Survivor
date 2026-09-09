import type { Clock } from '../interfaces'

/**
 * Demo clock. Pinned to a fixed instant so the season always opens in the same
 * state no matter when someone loads the GitHub Pages site: week 1 open, every
 * pick already in and still changeable, nothing kicked off yet. The
 * commissioner dashboard can move it forward or release it to real time.
 */
export const DEMO_NOW = '2026-09-09T16:00:00.000Z' // Wed before week 1, ahead of every kickoff

const KEY = 'survivor:demo:clock:v1'

export function createDemoClock(storage: Storage | null): Clock {
  let pinned: Date | null = new Date(DEMO_NOW)
  try {
    const stored = storage?.getItem(KEY)
    if (stored === 'real') pinned = null
    else if (stored) pinned = new Date(stored)
  } catch {
    /* storage unavailable (private mode, SSR) — keep default */
  }
  const listeners = new Set<() => void>()
  return {
    now: () => (pinned ? new Date(pinned) : new Date()),
    set(value) {
      pinned = value ? new Date(value) : null
      try {
        storage?.setItem(KEY, value ? value.toISOString() : 'real')
      } catch {
        /* ignore */
      }
      for (const l of listeners) l()
    },
    isPinned: () => pinned !== null,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
