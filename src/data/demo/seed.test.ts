import { beforeEach, describe, expect, it } from 'vitest'
import { scenario } from '@/domain/testing/scenario'
import { DEMO_FINGERPRINT_KEY, fixtureFingerprint, resetDemoStorageIfStale } from './seed'

class MemoryStorage implements Storage {
  private map = new Map<string, string>()
  get length() {
    return this.map.size
  }
  clear() {
    this.map.clear()
  }
  getItem(k: string) {
    return this.map.get(k) ?? null
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null
  }
  removeItem(k: string) {
    this.map.delete(k)
  }
  setItem(k: string, v: string) {
    this.map.set(k, v)
  }
}

const fixtureA = scenario().players('ann', 'bob').game(1, 'GB', 'CHI').pick('ann', 1, 'GB').build()

describe('demo seed fingerprint', () => {
  let storage: MemoryStorage
  beforeEach(() => {
    storage = new MemoryStorage()
  })

  it('is stable for the same fixture and changes when the roster changes', () => {
    expect(fixtureFingerprint(fixtureA)).toBe(fixtureFingerprint(structuredClone(fixtureA)))
    const reseeded = scenario()
      .players('maya', 'zac')
      .game(1, 'GB', 'CHI')
      .pick('maya', 1, 'GB')
      .build()
    expect(fixtureFingerprint(reseeded)).not.toBe(fixtureFingerprint(fixtureA))
  })

  it('changes even when the season id stays the same — the reseed bug', () => {
    // Same season id, different people: this is exactly the case that used to
    // leave stale data on screen after a reseed.
    const sameSeasonNewRoster = {
      ...structuredClone(fixtureA),
      profiles: [{ playerId: 'maya', displayName: 'Maya Israel', imageId: null }],
    }
    expect(sameSeasonNewRoster.season.id).toBe(fixtureA.season.id)
    expect(fixtureFingerprint(sameSeasonNewRoster)).not.toBe(fixtureFingerprint(fixtureA))
  })

  it('clears every demo key when the seed changed, and leaves other keys alone', () => {
    storage.setItem('survivor:demo:state:v1', '{"stale":true}')
    storage.setItem('survivor:demo:clock:v1', '2026-10-04T15:30:00.000Z')
    storage.setItem('unrelated-app-key', 'keep me')
    expect(resetDemoStorageIfStale(fixtureA, storage)).toBe(true)
    expect(storage.getItem('survivor:demo:state:v1')).toBeNull()
    expect(storage.getItem('survivor:demo:clock:v1')).toBeNull()
    expect(storage.getItem('unrelated-app-key')).toBe('keep me')
    expect(storage.getItem(DEMO_FINGERPRINT_KEY)).toBe(fixtureFingerprint(fixtureA))
  })

  it('is a no-op on the next load with an unchanged fixture, so edits survive', () => {
    resetDemoStorageIfStale(fixtureA, storage)
    storage.setItem('survivor:demo:state:v1', '{"my":"pick"}')
    expect(resetDemoStorageIfStale(fixtureA, storage)).toBe(false)
    expect(storage.getItem('survivor:demo:state:v1')).toBe('{"my":"pick"}')
  })

  it('tolerates storage being unavailable', () => {
    expect(resetDemoStorageIfStale(fixtureA, null)).toBe(false)
  })
})
