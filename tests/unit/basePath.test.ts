import { describe, expect, it } from 'vitest'
import { basePathFromRepository, resolveBasePath } from '../../build/basePath'

describe('resolveBasePath (GitHub Pages repository subpath)', () => {
  it('normalises every spelling of a repository base to /<repo>/', () => {
    expect(resolveBasePath('Survivor')).toBe('/Survivor/')
    expect(resolveBasePath('/Survivor')).toBe('/Survivor/')
    expect(resolveBasePath('/Survivor/')).toBe('/Survivor/')
    expect(resolveBasePath('  /Survivor/  ')).toBe('/Survivor/')
    expect(resolveBasePath('nested/path')).toBe('/nested/path/')
  })

  it('serves user/org sites and empty values from the root', () => {
    expect(resolveBasePath(undefined)).toBe('/')
    expect(resolveBasePath('')).toBe('/')
    expect(resolveBasePath('/')).toBe('/')
    expect(resolveBasePath('./')).toBe('/')
    expect(resolveBasePath('zac.github.io')).toBe('/')
  })

  it('derives the base from GITHUB_REPOSITORY in CI', () => {
    expect(basePathFromRepository('owner/Survivor')).toBe('/Survivor/')
    expect(basePathFromRepository('owner/owner.github.io')).toBe('/')
    expect(basePathFromRepository(undefined)).toBe('/')
  })
})
