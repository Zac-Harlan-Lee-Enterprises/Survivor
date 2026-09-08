import { describe, expect, it } from 'vitest'
import { cropRect, validateImageFile } from './image'

describe('validateImageFile', () => {
  it('accepts jpg, png and webp under 5 MB', () => {
    expect(validateImageFile({ type: 'image/jpeg', size: 1024 })).toEqual({ ok: true })
    expect(validateImageFile({ type: 'image/png', size: 1024 })).toEqual({ ok: true })
    expect(validateImageFile({ type: 'image/webp', size: 5 * 1024 * 1024 })).toEqual({ ok: true })
  })
  it('rejects unsupported types', () => {
    const r = validateImageFile({ type: 'image/gif', size: 10 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/Unsupported/)
    expect(validateImageFile({ type: 'image/svg+xml', size: 10 }).ok).toBe(false)
    expect(validateImageFile({ type: '', size: 10 }).ok).toBe(false)
  })
  it('rejects oversized and empty files', () => {
    const r = validateImageFile({ type: 'image/jpeg', size: 5 * 1024 * 1024 + 1 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/5 MB/)
    expect(validateImageFile({ type: 'image/jpeg', size: 0 }).ok).toBe(false)
  })
})

describe('cropRect', () => {
  it('centres the largest square at zoom 1', () => {
    expect(cropRect(400, 200, { zoom: 1, x: 0, y: 0 })).toEqual({ sx: 100, sy: 0, size: 200 })
  })
  it('zooms and pans within bounds', () => {
    expect(cropRect(400, 400, { zoom: 2, x: 1, y: -1 })).toEqual({ sx: 200, sy: 0, size: 200 })
    expect(cropRect(400, 400, { zoom: 0.5, x: 0, y: 0 })).toEqual({ sx: 0, sy: 0, size: 400 })
  })
})
