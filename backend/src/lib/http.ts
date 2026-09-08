import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda'
import type { z } from 'zod'

/** Small helpers for API Gateway HTTP API (payload v2) handlers. */

export class HttpError extends Error {
  status: number
  code: string
  extra: Record<string, unknown>

  constructor(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
    this.extra = extra
  }
}

export function json(status: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  }
}

export type EventLike = Pick<
  APIGatewayProxyEventV2WithJWTAuthorizer,
  | 'body'
  | 'isBase64Encoded'
  | 'requestContext'
  | 'rawPath'
  | 'queryStringParameters'
  | 'pathParameters'
>

export function parseBody<T>(
  event: Pick<EventLike, 'body' | 'isBase64Encoded'>,
  schema: z.ZodType<T>,
): T {
  let raw: unknown = null
  if (event.body) {
    const text = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body
    try {
      raw = JSON.parse(text)
    } catch {
      throw new HttpError(400, 'BAD_JSON', 'Request body is not valid JSON')
    }
  }
  const parsed = schema.safeParse(raw ?? {})
  if (!parsed.success) {
    throw new HttpError(
      400,
      'VALIDATION',
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    )
  }
  return parsed.data
}

export interface Identity {
  sub: string
  email: string | null
}

/** Claims come from the API Gateway JWT authorizer (Cognito), never from the request body. */
export function identityOf(event: Pick<EventLike, 'requestContext'>): Identity | null {
  const claims = event.requestContext?.authorizer?.jwt?.claims as
    Record<string, unknown> | undefined
  const sub = typeof claims?.sub === 'string' ? claims.sub : null
  if (!sub) return null
  const email = typeof claims?.email === 'string' ? claims.email.toLowerCase() : null
  return { sub, email }
}

export function errorResponse(err: unknown): APIGatewayProxyResultV2 {
  if (err instanceof HttpError)
    return json(err.status, { code: err.code, message: err.message, ...err.extra })
  console.error('Unhandled error', err)
  return json(500, { code: 'INTERNAL', message: 'Something went wrong on the league server.' })
}
