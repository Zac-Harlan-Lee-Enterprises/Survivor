import type { AppConfig } from '@/config/env'
import type { Services } from '../interfaces'
import { createOidcAuth } from './auth'
import { createHttpClient } from './http'
import {
  createApiImageRepository,
  createApiLeagueRepository,
  createApiNFLProvider,
  createApiPickRepository,
  createApiPlayerRepository,
} from './repositories'

export function createConnectedServices(config: AppConfig): Services {
  if (!config.cognito) throw new Error('Connected mode requires Cognito configuration')
  // Circular in spirit (auth needs http for /me, http needs auth for tokens),
  // resolved by a late-bound token getter.
  let tokenGetter: () => Promise<string | null> = async () => null
  const http = createHttpClient({ baseUrl: config.apiBaseUrl, getAccessToken: () => tokenGetter() })
  const auth = createOidcAuth({
    authority: config.cognito.authority,
    clientId: config.cognito.clientId,
    redirectUri: `${window.location.origin}${config.basePath}`,
    http,
  })
  tokenGetter = auth.getAccessToken
  const defaultAvatar = `${config.basePath}headshots/default.svg`
  return {
    mode: 'connected',
    leagues: createApiLeagueRepository(http),
    players: createApiPlayerRepository(http),
    picks: createApiPickRepository(http),
    nfl: createApiNFLProvider(http),
    images: createApiImageRepository(
      http,
      config.imageBaseUrl || `${config.apiBaseUrl}/images`,
      defaultAvatar,
    ),
    auth,
    clock: { now: () => new Date(), isPinned: () => false },
  }
}
