import type { AppConfig } from '@/config/env'
import { createConnectedServices } from './api'
import { createDemoServices } from './demo'
import type { Services } from './interfaces'

export * from './interfaces'

/** Chooses the runtime data mode from build-time configuration. */
export function createServices(config: AppConfig): Services {
  if (config.mode === 'connected') return createConnectedServices(config)
  return createDemoServices({
    assetBase: config.basePath,
    // Local commissioner mode — the same gate the Layout banner uses. The
    // published demo build is read-only and keeps concealment; connected mode
    // never reaches here and redacts server-side regardless.
    revealAllPicks: !config.readOnly,
  })
}
