import { DynamoStore } from '../lib/dynamo'
import { readEnv } from '../lib/env'
import { LeagueRepo } from '../lib/repo'
import { resolveProvider } from '../providers'
import { syncActiveSeasons } from '../sync'

/**
 * EventBridge Scheduler entry point. Runs every few minutes on game days;
 * idempotent by construction (see sync.ts), so overlap and retries are safe.
 * In manual mode it exits quietly: a provider outage never blocks the
 * commissioner, who can enter results by hand.
 */
export const handler = async (): Promise<{ synced: unknown[] }> => {
  const env = readEnv()
  if (env.nflProvider === 'manual') return { synced: [] }
  const deps = {
    repo: new LeagueRepo(new DynamoStore(env.tableName)),
    provider: resolveProvider(env),
    now: () => new Date(),
  }
  const synced = await syncActiveSeasons(deps)
  console.info(JSON.stringify({ message: 'results sync', synced }))
  return { synced }
}
