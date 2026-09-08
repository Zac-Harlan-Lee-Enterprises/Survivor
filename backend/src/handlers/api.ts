import { randomUUID } from 'node:crypto'
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda'
import { createApp, Router, type AppDeps } from '../app'
import { DynamoStore } from '../lib/dynamo'
import { readEnv } from '../lib/env'
import { LeagueRepo } from '../lib/repo'
import { createS3Storage } from '../lib/s3'
import { resolveProvider } from '../providers'
import { registerLeagueRoutes } from '../routes/league'
import { registerNflRoutes } from '../routes/nfl'
import { registerPickRoutes } from '../routes/picks'
import { registerPlayerRoutes } from '../routes/players'

/** Lambda entry point for the HTTP API (one function, all routes). */

export function buildRouter(): Router {
  const router = new Router()
  registerLeagueRoutes(router)
  registerPickRoutes(router)
  registerPlayerRoutes(router)
  registerNflRoutes(router)
  return router
}

let cached:
  ((event: APIGatewayProxyEventV2WithJWTAuthorizer) => Promise<APIGatewayProxyResultV2>) | null =
  null

function app() {
  if (cached) return cached
  const env = readEnv()
  const deps: AppDeps = {
    repo: new LeagueRepo(new DynamoStore(env.tableName)),
    storage: createS3Storage(env.imagesBucket),
    provider: resolveProvider(env),
    env,
    now: () => new Date(),
    newId: () => randomUUID(),
  }
  cached = createApp(deps, buildRouter())
  return cached
}

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> => app()(event)
