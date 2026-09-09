import { describe, expect, it } from 'vitest'
import { parseConfig } from './env'

describe('parseConfig — published vs local', () => {
  it('is read-only when a demo build is served from anywhere but this machine', () => {
    expect(parseConfig({}, { hostname: 'zac-harlan-lee-enterprises.github.io' }).readOnly).toBe(
      true,
    )
    expect(parseConfig({}, { hostname: 'survivor.example.com' }).readOnly).toBe(true)
  })

  it('stays interactive when the commissioner runs it locally', () => {
    for (const hostname of ['localhost', '127.0.0.1', '0.0.0.0', '[::1]']) {
      expect(parseConfig({}, { hostname }).readOnly, hostname).toBe(false)
    }
    // No browser at all (tests, SSR): treat as local rather than crippling it.
    expect(parseConfig({}).readOnly).toBe(false)
  })

  it('is always interactive in connected mode, where picks really are shared', () => {
    const connected = {
      VITE_DATA_MODE: 'connected',
      VITE_API_BASE_URL: 'https://api.example.com',
      VITE_COGNITO_AUTHORITY: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_abc',
      VITE_COGNITO_CLIENT_ID: 'client',
    }
    expect(parseConfig(connected, { hostname: 'zac.github.io' }).readOnly).toBe(false)
  })

  it('can be forced either way for previewing and for tests', () => {
    expect(parseConfig({ VITE_READ_ONLY: 'true' }, { hostname: 'localhost' }).readOnly).toBe(true)
    expect(parseConfig({ VITE_READ_ONLY: 'false' }, { hostname: 'example.com' }).readOnly).toBe(
      false,
    )
  })
})

describe('parseConfig', () => {
  it('defaults to demo mode at the root base', () => {
    const c = parseConfig({})
    expect(c.mode).toBe('demo')
    expect(c.basePath).toBe('/')
    expect(c.cognito).toBeNull()
  })

  it('keeps a repository subpath base with trailing slash', () => {
    expect(parseConfig({ BASE_URL: '/Survivor/' }).basePath).toBe('/Survivor/')
    expect(parseConfig({ BASE_URL: '/Survivor' }).basePath).toBe('/Survivor/')
  })

  it('refuses connected mode without an https API and Cognito settings', () => {
    expect(() => parseConfig({ VITE_DATA_MODE: 'connected' })).toThrow(/https/)
    expect(() =>
      parseConfig({ VITE_DATA_MODE: 'connected', VITE_API_BASE_URL: 'https://api.example.com/' }),
    ).toThrow(/COGNITO/)
    const c = parseConfig({
      VITE_DATA_MODE: 'connected',
      VITE_API_BASE_URL: 'https://api.example.com/',
      VITE_COGNITO_AUTHORITY: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_abc',
      VITE_COGNITO_CLIENT_ID: 'client',
    })
    expect(c.apiBaseUrl).toBe('https://api.example.com')
    expect(c.cognito?.clientId).toBe('client')
  })
})
