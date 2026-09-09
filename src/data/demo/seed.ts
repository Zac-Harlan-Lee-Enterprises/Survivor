import type { SeasonSnapshot } from '@/domain'

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

/**
 * Drops the whole demo overlay (state, clock, anything else under the prefix)
 * when the seeded fixture no longer matches what the browser last saw.
 * Returns true when a reset happened.
 */
export function resetDemoStorageIfStale(fixture: SeasonSnapshot, storage: Storage | null): boolean {
  if (!storage) return false
  const current = fixtureFingerprint(fixture)
  try {
    if (storage.getItem(DEMO_FINGERPRINT_KEY) === current) return false
    const doomed: string[] = []
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (key?.startsWith(DEMO_KEY_PREFIX)) doomed.push(key)
    }
    for (const key of doomed) storage.removeItem(key)
    storage.setItem(DEMO_FINGERPRINT_KEY, current)
    return doomed.length > 0
  } catch {
    // Private mode / storage disabled: nothing persisted, nothing to reset.
    return false
  }
}
