import { describe, expect, it } from 'vitest'
import { parseConfig } from './env'

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
