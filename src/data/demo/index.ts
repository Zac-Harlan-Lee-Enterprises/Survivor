import { SeasonSnapshotSchema } from '@/domain'
import type { Services } from '../interfaces'
import { createDemoAuth } from './auth'
import { createDemoClock, DEMO_NOW } from './clock'
import {
  createDemoImageRepository,
  createDemoLeagueRepository,
  createDemoNFLProvider,
  createDemoPickRepository,
  createDemoPlayerRepository,
} from './repositories'
import { resetDemoStorageIfStale } from './seed'
import { DemoStore } from './store'
import fixture from './fixtures/demo-season.json'

export interface DemoOptions {
  storage?: Storage | null
  assetBase: string
}

export function createDemoServices(options: DemoOptions): Services {
  const storage = options.storage === undefined ? safeLocalStorage() : options.storage
  const snapshot = SeasonSnapshotSchema.parse(fixture)
  // A reseeded fixture must win over whatever this browser saved last time,
  // otherwise the app appears not to update no matter how often it restarts.
  resetDemoStorageIfStale(snapshot, storage)
  const store = new DemoStore(snapshot, storage)
  const clock = createDemoClock(storage)
  const auth = createDemoAuth(store)
  const viewer = () => {
    const s = auth.getSession()
    return { playerId: s?.actor.playerId ?? null, isCommissioner: s?.actor.isCommissioner ?? false }
  }
  const ctx = { store, clock, viewer, assetBase: options.assetBase }
  return {
    mode: 'demo',
    leagues: createDemoLeagueRepository(ctx),
    players: createDemoPlayerRepository(ctx),
    picks: createDemoPickRepository(ctx),
    nfl: createDemoNFLProvider(ctx),
    images: createDemoImageRepository(ctx),
    auth,
    clock,
    async resetDemo() {
      store.reset()
      clock.set?.(new Date(DEMO_NOW))
    },
  }
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}
