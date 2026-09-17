import type { SeasonSnapshot } from '@/domain'
import { DEMO_STORAGE_KEY } from './store'

/**
 * Every localStorage key demo mode owns. Listed in one place so a reseed can
 * clear all of them together.
 */
export const DEMO_KEY_PREFIX = 'survivor:demo:'
export const DEMO_FINGERPRINT_KEY = `${DEMO_KEY_PREFIX}seed:v1`

/**
 * Stable fingerprint of the seeded fixture.
 *
 * WHY THIS EXISTS: demo mode keeps a localStorage overlay on top of the seeded
 * fixture. Before this, the overlay was only discarded when the SEASON ID
 * changed — so reseeding the league with a different roster under the same
 * season id left every returning browser showing the old data forever. The app
 * looked like it had not restarted, because for that browser it had not: the
 * stale snapshot won over the new seed on every load.
 *
 * Fingerprinting the whole fixture makes any seed change invalidate the
 * overlay, whatever changed.
 */
export function fixtureFingerprint(fixture: SeasonSnapshot): string {
  const json = JSON.stringify(fixture)
  // FNV-1a, 32-bit. Not cryptographic — it only has to change when the seed does.
  let hash = 0x811c9dc5
  for (let i = 0; i < json.length; i++) {
    hash ^= json.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `${json.length.toString(36)}-${hash.toString(36)}`
}

export interface ResetOutcome {
  /** True when a stale overlay was actually dropped. */
  reset: boolean
  /**
   * Who was signed in before the reset, so the app can sign them back in.
   *
   * WHY: the session lives inside the overlay blob, so dropping the overlay
   * used to sign the viewer out on every reseed. For the commissioner — who
   * regenerates the fixture each time they transcribe a week's replies — that
   * looked exactly like the new picks had not loaded, because signed out is
   * also the state that sees the least. The session is a preference about this
   * browser, not seeded league data, so it survives the seed changing under it.
   */
  sessionPlayerId: string | null
}

/**
 * Drops the whole demo overlay (state, clock, anything else under the prefix)
 * when the seeded fixture no longer matches what the browser last saw, and
 * reports who was signed in so the caller can restore them.
 */
export function resetDemoStorageIfStale(
  fixture: SeasonSnapshot,
  storage: Storage | null,
): ResetOutcome {
  const none: ResetOutcome = { reset: false, sessionPlayerId: null }
  if (!storage) return none
  const current = fixtureFingerprint(fixture)
  try {
    if (storage.getItem(DEMO_FINGERPRINT_KEY) === current) return none
    const doomed: string[] = []
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (key?.startsWith(DEMO_KEY_PREFIX)) doomed.push(key)
    }
    const sessionPlayerId = readSessionPlayerId(storage)
    for (const key of doomed) storage.removeItem(key)
    storage.setItem(DEMO_FINGERPRINT_KEY, current)
    return { reset: doomed.length > 0, sessionPlayerId }
  } catch {
    // Private mode / storage disabled: nothing persisted, nothing to reset.
    return none
  }
}

/** Best-effort: a corrupt or absent overlay simply means nobody to restore. */
function readSessionPlayerId(storage: Storage): string | null {
  try {
    const raw = storage.getItem(DEMO_STORAGE_KEY)
    if (!raw) return null
    const id: unknown = JSON.parse(raw)?.sessionPlayerId
    return typeof id === 'string' && id !== '' ? id : null
  } catch {
    return null
  }
}
