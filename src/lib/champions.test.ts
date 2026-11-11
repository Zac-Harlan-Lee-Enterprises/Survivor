import { describe, expect, it } from 'vitest'
import { banners, type Banner } from './champions'

const b = (year: number, name: string): Banner => ({
  year,
  winners: [{ playerId: name.toLowerCase(), name }],
})

describe('banners', () => {
  it('hangs this season’s first, then the hall, newest first', () => {
    expect(banners(b(2026, 'Ann'), [b(2024, 'Cat'), b(2025, 'Bo')]).map((x) => x.year)).toEqual([
      2026, 2025, 2024,
    ])
  })

  it('hangs a season once, even when it is already in the hall', () => {
    const hung = banners(b(2026, 'Ann'), [b(2026, 'Ann'), b(2025, 'Bo')])
    expect(hung.map((x) => x.year)).toEqual([2026, 2025])
  })

  it('is only the hall while this season is undecided', () => {
    expect(banners(null, [b(2025, 'Bo')])).toEqual([b(2025, 'Bo')])
    expect(banners(null, [])).toEqual([])
  })
})
