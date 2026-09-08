import { z } from 'zod'

/**
 * Build-time configuration, validated once at startup. Everything here is
 * PUBLIC — Vite inlines VITE_* values into the bundle served by GitHub Pages.
 * Secrets never appear here; they live behind the AWS API.
 */
const EnvSchema = z.object({
  VITE_DATA_MODE: z.enum(['demo', 'connected']).default('demo'),
  VITE_API_BASE_URL: z.string().default(''),
  VITE_COGNITO_AUTHORITY: z.string().default(''),
  VITE_COGNITO_CLIENT_ID: z.string().default(''),
  VITE_IMAGE_BASE_URL: z.string().default(''),
  VITE_DEFAULT_LEAGUE_ID: z.string().default('demo-league'),
  BASE_URL: z.string().default('/'),
})

export interface AppConfig {
  mode: 'demo' | 'connected'
  /** Vite base, always with leading and trailing slash (e.g. "/Survivor/"). */
  basePath: string
  apiBaseUrl: string
  cognito: { authority: string; clientId: string } | null
  imageBaseUrl: string
  defaultLeagueId: string
}

export function parseConfig(raw: Record<string, unknown>): AppConfig {
  const env = EnvSchema.parse(raw)
  const mode = env.VITE_DATA_MODE
  if (mode === 'connected' && !/^https:\/\//.test(env.VITE_API_BASE_URL)) {
    throw new Error(
      'VITE_DATA_MODE=connected requires an https:// VITE_API_BASE_URL. The GitHub Pages bundle cannot host an API itself.',
    )
  }
  const hasCognito = env.VITE_COGNITO_AUTHORITY !== '' && env.VITE_COGNITO_CLIENT_ID !== ''
  if (mode === 'connected' && !hasCognito) {
    throw new Error(
      'VITE_DATA_MODE=connected requires VITE_COGNITO_AUTHORITY and VITE_COGNITO_CLIENT_ID.',
    )
  }
  return {
    mode,
    basePath: env.BASE_URL.endsWith('/') ? env.BASE_URL : `${env.BASE_URL}/`,
    apiBaseUrl: env.VITE_API_BASE_URL.replace(/\/+$/, ''),
    cognito: hasCognito
      ? { authority: env.VITE_COGNITO_AUTHORITY, clientId: env.VITE_COGNITO_CLIENT_ID }
      : null,
    imageBaseUrl: env.VITE_IMAGE_BASE_URL.replace(/\/+$/, ''),
    defaultLeagueId: env.VITE_DEFAULT_LEAGUE_ID,
  }
}

let cached: AppConfig | null = null

export function getConfig(): AppConfig {
  if (!cached) cached = parseConfig(import.meta.env as unknown as Record<string, unknown>)
  return cached
}
