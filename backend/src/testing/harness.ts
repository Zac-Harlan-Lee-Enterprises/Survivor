import type { APIGatewayProxyResultV2 } from 'aws-lambda'
import type { ImageContentType, NFLGame, NFLWeek, SeasonSnapshot } from '@domain/index'
import { createApp, type AppDeps } from '../app'
import { readEnv } from '../lib/env'
import type { ObjectHead, ObjectStorage } from '../lib/images'
import { LeagueRepo } from '../lib/repo'
import { MemoryStore } from '../lib/store'
import type { ExternalNFLProvider } from '../providers'
import { buildRouter } from '../handlers/api'

/** Everything a route test needs: seeded store, fake S3, fake provider, fixed clock. */

export class FakeStorage implements ObjectStorage {
  objects = new Map<string, ObjectHead>()
  deleted: string[] = []
  async presignPost(key: string, contentType: ImageContentType, maxBytes: number) {
    return {
      url: `https://bucket.s3.amazonaws.com/`,
      fields: { key, 'Content-Type': contentType, 'x-max': String(maxBytes) },
    }
  }
  async head(key: string) {
    return this.objects.get(key) ?? null
  }
  async delete(key: string) {
    this.objects.delete(key)
    this.deleted.push(key)
  }
  /** Simulates the browser having POSTed an object. */
  upload(key: string, head: ObjectHead) {
    this.objects.set(key, head)
  }
}

export class FakeProvider implements ExternalNFLProvider {
  name = 'fake'
  calls = 0
  private weeks: Record<number, { games: NFLGame[]; week: NFLWeek }>
  constructor(weeks: Record<number, { games: NFLGame[]; week: NFLWeek }>) {
    this.weeks = weeks
  }
  async fetchWeek(_year: number, week: number) {
    this.calls += 1
    const w = this.weeks[week]
    if (!w) throw new Error(`provider has no week ${week}`)
    return w
  }
  set(week: number, games: NFLGame[], byeTeamIds: string[] = []) {
    this.weeks[week] = {
      games,
      week: { seasonYear: games[0]?.seasonYear ?? 2026, week, label: `Week ${week}`, byeTeamIds },
    }
  }
}

export interface Harness {
  deps: AppDeps
  repo: LeagueRepo
  store: MemoryStore
  storage: FakeStorage
  provider: FakeProvider
  clock: { now: Date }
  call: (
    method: string,
    path: string,
    opts?: { body?: unknown; sub?: string; email?: string; query?: Record<string, string> },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests poke at arbitrary JSON
  ) => Promise<{ status: number; body: any }>
  /** Registers a Cognito identity for a player. */
  link: (sub: string, playerId: string) => Promise<void>
}

export async function createHarness(
  snapshot: SeasonSnapshot,
  now: Date | string,
): Promise<Harness> {
  const store = new MemoryStore()
  const repo = new LeagueRepo(store)
  const storage = new FakeStorage()
  const provider = new FakeProvider({})
  const clock = { now: new Date(now) }
  let counter = 0
  const env = {
    ...readEnv({}),
    defaultLeagueId: snapshot.league.id,
    imagesBucket: 'bucket',
    nflProvider: 'espn' as const,
  }
  const deps: AppDeps = {
    repo,
    storage,
    provider,
    env,
    now: () => new Date(clock.now),
    newId: () => `id-${++counter}`,
  }

  await repo.putLeague(snapshot.league)
  await repo.putSeason(snapshot.season)
  for (const m of snapshot.memberships) await repo.putMembership(m)
  for (const p of snapshot.profiles)
    await repo.putProfile({ ...p, email: `${p.playerId}@example.com` })
  for (const i of snapshot.images) await repo.putImage(i)
  for (const p of snapshot.picks) await repo.forcePick(p)
  for (const g of snapshot.games) await repo.saveGame(g, null)
  for (const w of snapshot.weeks) await repo.putWeek(w)
  for (const o of snapshot.gameOverrides) await repo.putGameOverride(o)
  if (snapshot.decision) await repo.putDecision(snapshot.decision)

  const app = createApp(deps, buildRouter())
  const call: Harness['call'] = async (method, path, opts = {}) => {
    const res = (await app({
      rawPath: path,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      isBase64Encoded: false,
      queryStringParameters: opts.query,
      pathParameters: undefined,
      requestContext: {
        http: { method },
        authorizer: opts.sub
          ? { jwt: { claims: { sub: opts.sub, email: opts.email ?? `${opts.sub}@example.com` } } }
          : undefined,
      } as never,
    })) as Exclude<APIGatewayProxyResultV2, string>
    return { status: res.statusCode ?? 200, body: res.body ? JSON.parse(res.body) : null }
  }
  return {
    deps,
    repo,
    store,
    storage,
    provider,
    clock,
    call,
    link: (sub, playerId) => repo.putUserLink(sub, playerId),
  }
}
