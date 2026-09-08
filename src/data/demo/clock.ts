import type { Clock } from '../interfaces'

/**
 * Demo clock. Pinned to a fixed instant by default so the demo season always
 * shows the same "live" week (results for weeks 1–3, week 4 open) no matter
 * when someone opens the GitHub Pages site. The commissioner dashboard can
 * move it or release it to real time.
 */
export const DEMO_NOW = '2026-10-04T15:30:00.000Z' // Sunday of week 4, 11:30am ET

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
