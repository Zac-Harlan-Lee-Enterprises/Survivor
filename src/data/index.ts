import type { AppConfig } from '@/config/env'
import { createConnectedServices } from './api'
import { createDemoServices } from './demo'
import type { Services } from './interfaces'

export * from './interfaces'

/** Chooses the runtime data mode from build-time configuration. */
export function createServices(config: AppConfig): Services {
  if (config.mode === 'connected') return createConnectedServices(config)
  return createDemoServices({ assetBase: config.basePath })
}
