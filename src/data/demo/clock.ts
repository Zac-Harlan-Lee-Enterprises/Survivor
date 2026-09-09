import type { Clock } from '../interfaces'

/**
 * Demo clock. Runs on REAL time by default: the schedule is the real NFL one,
 * so countdowns, the pick deadline and lock states must match the actual clock.
 * A pinned instant would make every "next kickoff in ..." fictional.
 *
 * The commissioner dashboard can still pin it (useful for demos and for
 * watching a week play out), and tests pin it for determinism.
 */
export const DEMO_NOW = '2026-09-09T16:00:00.000Z' // Wed before week 1 — used by tests and demos

const KEY = 'survivor:demo:clock:v1'

export function createDemoClock(storage: Storage | null): Clock {
  let pinned: Date | null = null
  try {
    const stored = storage?.getItem(KEY)
    if (stored && stored !== 'real') pinned = new Date(stored)
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
