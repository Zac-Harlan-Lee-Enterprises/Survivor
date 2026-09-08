import type { z } from 'zod'
import { DataError } from '../interfaces'

/**
 * THE ONLY MODULE THAT CALLS fetch(). Enforced by tests/architecture.
 *
 * All requests go to the external AWS API over HTTPS with a Cognito bearer
 * token. The static GitHub Pages bundle holds no secrets: the token is the
 * user's own, obtained via Authorization Code + PKCE in the browser.
 */

export interface HttpClientOptions {
  baseUrl: string
  getAccessToken: () => Promise<string | null>
  fetchImpl?: typeof fetch
}

export interface RequestOptions<T> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  schema?: z.ZodType<T>
  /** Treat these statuses as expected and return the parsed body. */
  okStatuses?: number[]
  /**
   * Public read: when the visitor has no token the request goes to the
   * anonymous /public prefix (the authenticated prefix requires a JWT).
   */
  publicRead?: boolean
}

export interface HttpClient {
  request<T = unknown>(path: string, options?: RequestOptions<T>): Promise<T>
  /** Presigned S3 POST — no auth header, multipart form. */
  postForm(url: string, fields: Record<string, string>, file: Blob): Promise<void>
}

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const fetchImpl = options.fetchImpl ?? fetch
  return {
    async request<T>(path: string, req: RequestOptions<T> = {}): Promise<T> {
      const token = await options.getAccessToken()
      const headers: Record<string, string> = { Accept: 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      if (req.body !== undefined) headers['Content-Type'] = 'application/json'
      const target = req.publicRead && !token ? `/public${path}` : path
      let res: Response
      try {
        res = await fetchImpl(`${options.baseUrl}${target}`, {
          method: req.method ?? 'GET',
          headers,
          body: req.body === undefined ? undefined : JSON.stringify(req.body),
        })
      } catch {
        throw new DataError(
          'NETWORK',
          'The league server could not be reached. Check your connection and try again.',
          { status: 0 },
        )
      }
      const text = await res.text()
      const json: unknown = text ? safeJson(text) : null
      if (!res.ok && !(req.okStatuses ?? []).includes(res.status)) {
        const body = (json ?? {}) as {
          code?: string
          message?: string
          violations?: DataError['violations']
        }
        throw new DataError(
          body.code ?? `HTTP_${res.status}`,
          body.message ?? `Request failed (${res.status})`,
          {
            status: res.status,
            violations: body.violations,
          },
        )
      }
      if (req.schema) {
        const parsed = req.schema.safeParse(json)
        if (!parsed.success) {
          throw new DataError(
            'BAD_RESPONSE',
            `Unexpected response from ${path}: ${parsed.error.issues[0]?.message ?? 'invalid'}`,
          )
        }
        return parsed.data
      }
      return json as T
    },
    async postForm(url, fields, file) {
      const form = new FormData()
      for (const [k, v] of Object.entries(fields)) form.append(k, v)
      form.append('file', file)
      let res: Response
      try {
        res = await fetchImpl(url, { method: 'POST', body: form })
      } catch {
        throw new DataError(
          'UPLOAD_NETWORK',
          'The image upload could not reach storage. Try again.',
          { status: 0 },
        )
      }
      if (!res.ok) {
        throw new DataError(
          'UPLOAD_REJECTED',
          `Storage rejected the image (${res.status}). Only JPG, PNG or WebP up to 5 MB are accepted.`,
          { status: res.status },
        )
      }
    },
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}
