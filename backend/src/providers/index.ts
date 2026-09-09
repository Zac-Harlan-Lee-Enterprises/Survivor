import type { BackendEnv } from '../lib/env'
import { createEspnProvider } from './espn'
import type { ExternalNFLProvider } from './types'

export * from './types'

/**
 * Manual mode: no external polling at all. Schedules and results are entered
 * by the commissioner (PUT /nfl/{year}/weeks/{week}/games, POST manual-result).
 */
export const manualProvider: ExternalNFLProvider = {
  name: 'manual',
  async fetchWeek() {
    throw new Error(
      'Manual provider: no external feed configured. Enter results in the commissioner dashboard.',
    )
  },
}

/**
 * A licensed provider needing a secret would read it here from SSM Parameter
 * Store (env.nflProviderSecretParam) — never from the browser bundle.
 */
export function resolveProvider(
  env: BackendEnv,
  fetchImpl: typeof fetch = fetch,
): ExternalNFLProvider {
  if (env.nflProvider === 'espn') return createEspnProvider(fetchImpl)
  return manualProvider
}
