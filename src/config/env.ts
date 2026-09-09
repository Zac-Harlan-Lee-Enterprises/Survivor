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
  /** Force the published (read-only) experience on or off. Rarely needed. */
  VITE_READ_ONLY: z.enum(['true', 'false']).optional(),
  BASE_URL: z.string().default('/'),
})

const LOCAL_HOSTS = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/

export interface AppConfig {
  mode: 'demo' | 'connected'
  /** Vite base, always with leading and trailing slash (e.g. "/Survivor/"). */
  basePath: string
  apiBaseUrl: string
  cognito: { authority: string; clientId: string } | null
  imageBaseUrl: string
  defaultLeagueId: string
  /**
   * A published, read-only view of the league.
   *
   * In demo mode nothing a visitor does can reach anyone else — writes stay in
   * their own browser. Showing "Sign in" and "Make my pick" on the published
   * site would invite people to make picks that quietly go nowhere, so the
   * published build hides every write affordance and presents the league as
   * what it is: a scoreboard the commissioner keeps up to date.
   *
   * Running locally (the commissioner's own machine) keeps full editing, and
   * connected mode is always interactive because picks really are shared.
   *
   * This is presentation, not a security boundary: demo mode has no server, so
   * there is nothing to protect. It exists so the UI does not mislead.
   */
  readOnly: boolean
}

export interface RuntimeHints {
  /** window.location.hostname, or undefined when there is no browser. */
  hostname?: string
}

export function parseConfig(raw: Record<string, unknown>, hints: RuntimeHints = {}): AppConfig {
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
  const isLocal = hints.hostname === undefined || LOCAL_HOSTS.test(hints.hostname)
  const readOnly =
    env.VITE_READ_ONLY !== undefined ? env.VITE_READ_ONLY === 'true' : mode === 'demo' && !isLocal

  return {
    mode,
    readOnly,
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
  if (!cached) {
    cached = parseConfig(import.meta.env as unknown as Record<string, unknown>, {
      hostname: typeof window === 'undefined' ? undefined : window.location.hostname,
    })
  }
  return cached
}
