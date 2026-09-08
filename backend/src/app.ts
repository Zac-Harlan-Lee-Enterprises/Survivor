import type { APIGatewayProxyResultV2 } from 'aws-lambda'
import type { League, LeagueMembership, Season } from '@domain/index'
import type { BackendEnv } from './lib/env'
import { errorResponse, HttpError, identityOf, json, type EventLike } from './lib/http'
import type { ObjectStorage } from './lib/images'
import type { LeagueRepo } from './lib/repo'
import type { ExternalNFLProvider } from './providers'

/**
 * The API is a modular monolith: one Lambda, one router, plain functions per
 * route. Every handler receives the same Context, so tests can call routes
 * directly with an in-memory store and a fixed clock.
 */

export interface AppDeps {
  repo: LeagueRepo
  storage: ObjectStorage
  provider: ExternalNFLProvider
  env: BackendEnv
  now: () => Date
  newId: () => string
}

export interface Actor {
  playerId: string
  displayName: string
}

export interface Context extends AppDeps {
  event: EventLike
  params: Record<string, string>
  query: Record<string, string>
  /** Resolved lazily; null for anonymous requests (public read routes). */
  actor: () => Promise<Actor | null>
  requireActor: () => Promise<Actor>
  /** Loads league + current season and checks commissioner role. */
  requireCommissioner: (
    leagueId: string,
  ) => Promise<{ league: League; season: Season; actor: Actor; membership: LeagueMembership }>
  loadLeagueSeason: (seasonId: string) => Promise<{ league: League; season: Season }>
  isCommissioner: (league: League, playerId: string | null) => Promise<boolean>
}

export type RouteHandler = (ctx: Context) => Promise<APIGatewayProxyResultV2>

interface Route {
  method: string
  pattern: RegExp
  keys: string[]
  handler: RouteHandler
}

export class Router {
  private routes: Route[] = []

  add(method: string, path: string, handler: RouteHandler): this {
    const keys: string[] = []
    const pattern = new RegExp(
      '^' +
        path.replace(/\/:([a-zA-Z]+)/g, (_m, k: string) => {
          keys.push(k)
          return '/([^/]+)'
        }) +
        '/?$',
    )
    this.routes.push({ method, pattern, keys, handler })
    return this
  }

  match(
    method: string,
    path: string,
  ): { handler: RouteHandler; params: Record<string, string> } | null {
    for (const r of this.routes) {
      if (r.method !== method) continue
      const m = r.pattern.exec(path)
      if (!m) continue
      const params: Record<string, string> = {}
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1] ?? '')))
      return { handler: r.handler, params }
    }
    return null
  }
}

export function createApp(deps: AppDeps, router: Router) {
  return async (event: EventLike): Promise<APIGatewayProxyResultV2> => {
    const method = (
      (event.requestContext as { http?: { method?: string } })?.http?.method ?? 'GET'
    ).toUpperCase()
    let path = event.rawPath ?? '/'
    // API Gateway attaches the Cognito authorizer to /{proxy+} only; anonymous
    // reads arrive under /public/... (no authorizer) and are served by the same
    // routes with no identity. Writes are never accepted there.
    if (path === '/public' || path.startsWith('/public/')) {
      if (method !== 'GET')
        return json(405, { code: 'METHOD_NOT_ALLOWED', message: 'Sign in to make changes.' })
      path = path.slice('/public'.length) || '/'
      ;(event as { requestContext: unknown }).requestContext = {
        ...(event.requestContext as object),
        authorizer: undefined,
      }
    }
    const matched = router.match(method, path)
    if (!matched) return json(404, { code: 'NOT_FOUND', message: `No route for ${method} ${path}` })
    const ctx = buildContext(deps, event, matched.params)
    try {
      return await matched.handler(ctx)
    } catch (err) {
      return errorResponse(err)
    }
  }
}

function buildContext(deps: AppDeps, event: EventLike, params: Record<string, string>): Context {
  let actorPromise: Promise<Actor | null> | null = null

  const actor = () => {
    if (!actorPromise) actorPromise = resolveActor(deps, event)
    return actorPromise
  }
  const requireActor = async () => {
    const a = await actor()
    if (!a) throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in to continue')
    return a
  }
  const loadLeagueSeason = async (seasonId: string) => {
    const season = await deps.repo.findSeason(seasonId)
    if (!season) throw new HttpError(404, 'NOT_FOUND', `Season ${seasonId} not found`)
    const league = await deps.repo.getLeague(season.leagueId)
    if (!league) throw new HttpError(404, 'NOT_FOUND', `League ${season.leagueId} not found`)
    return { league, season }
  }
  const isCommissioner = async (league: League, playerId: string | null) => {
    if (!playerId) return false
    const m = await deps.repo.getMembership(league.id, league.currentSeasonId, playerId)
    return m?.role === 'commissioner' && m.status === 'active'
  }
  const requireCommissioner = async (leagueId: string) => {
    const a = await requireActor()
    const league = await deps.repo.getLeague(leagueId)
    if (!league) throw new HttpError(404, 'NOT_FOUND', `League ${leagueId} not found`)
    const season = await deps.repo.getSeason(league.id, league.currentSeasonId)
    if (!season) throw new HttpError(404, 'NOT_FOUND', 'Current season not found')
    const membership = await deps.repo.getMembership(league.id, season.id, a.playerId)
    if (!membership || membership.role !== 'commissioner' || membership.status !== 'active') {
      throw new HttpError(403, 'FORBIDDEN', 'Only the commissioner can do that.')
    }
    return { league, season, actor: a, membership }
  }

  return {
    ...deps,
    event,
    params,
    query: (event.queryStringParameters as Record<string, string> | undefined) ?? {},
    actor,
    requireActor,
    requireCommissioner,
    loadLeagueSeason,
    isCommissioner,
  }
}

/**
 * Maps the Cognito identity (sub/email from the JWT authorizer) to a player.
 * First sign-in links by the email the commissioner entered for the player;
 * afterwards the sub→player link row is authoritative.
 */
async function resolveActor(deps: AppDeps, event: EventLike): Promise<Actor | null> {
  const identity = identityOf(event)
  if (!identity) return null
  let playerId = await deps.repo.getUserLink(identity.sub)
  if (!playerId && identity.email) {
    const league = await deps.repo.getLeague(deps.env.defaultLeagueId)
    if (league) {
      const members = await deps.repo.listMemberships(league.id, league.currentSeasonId)
      playerId = await deps.repo.findPlayerByEmail(
        identity.email,
        members.map((m) => m.playerId),
      )
      if (playerId) await deps.repo.putUserLink(identity.sub, playerId)
    }
  }
  if (!playerId) return null
  const profile = await deps.repo.getProfile(playerId)
  return { playerId, displayName: profile?.displayName ?? playerId }
}
