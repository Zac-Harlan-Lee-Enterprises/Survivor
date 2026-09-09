import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * CROP_NUDGES in the headshot importer is keyed by player id. A typo there is
 * silent — the photo simply keeps its automatic crop, and the person who wrote
 * the nudge is left wondering why nothing moved. These tests make that loud.
 */
const importer = readFileSync('scripts/import-headshots.mjs', 'utf8')
const generator = readFileSync('scripts/generate-demo-fixtures.ts', 'utf8')

function nudges(): { playerId: string; x?: number; y?: number; zoom?: number }[] {
  const block = importer.slice(
    importer.indexOf('const CROP_NUDGES = {'),
    importer.indexOf('const ACCEPTED'),
  )
  return [...block.matchAll(/'([a-z0-9-]+)':\s*\{([^}]*)\}/g)].map((m) => {
    const body = m[2] ?? ''
    const num = (key: string) => {
      const hit = new RegExp(`${key}:\\s*([0-9.]+)`).exec(body)
      return hit ? Number(hit[1]) : undefined
    }
    return { playerId: m[1] ?? '', x: num('x'), y: num('y'), zoom: num('zoom') }
  })
}

function rosterIds(): string[] {
  const block = generator.slice(
    generator.indexOf('const PEOPLE: Person[] = ['),
    generator.indexOf('/** [team, outcome]'),
  )
  return [...block.matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1] ?? '')
}

describe('headshot crop nudges', () => {
  it('reads the roster, so the comparison below means something', () => {
    expect(rosterIds().length).toBeGreaterThan(5)
  })

  it('every nudge names a player who is actually in the league', () => {
    const roster = rosterIds()
    for (const n of nudges()) {
      expect(roster, `${n.playerId} is nudged but is not on the roster`).toContain(n.playerId)
    }
  })

  it('every offset is a fraction of the image, never a pixel count', () => {
    for (const n of nudges()) {
      for (const axis of ['x', 'y'] as const) {
        const v = n[axis]
        if (v === undefined) continue
        expect(v, `${n.playerId}.${axis}`).toBeGreaterThanOrEqual(0)
        expect(v, `${n.playerId}.${axis}`).toBeLessThanOrEqual(1)
      }
    }
  })

  /**
   * A zoom of 0 would crop nothing at all, and above 1 would ask for more
   * picture than the source holds. Both fail silently rather than loudly.
   */
  it('every zoom keeps a real fraction of the source', () => {
    for (const n of nudges()) {
      if (n.zoom === undefined) continue
      expect(n.zoom, `${n.playerId}.zoom`).toBeGreaterThan(0)
      expect(n.zoom, `${n.playerId}.zoom`).toBeLessThanOrEqual(1)
    }
  })

  /** Zooming crops away pixels, so it needs a centre worth zooming to. */
  it('a zoom names where to zoom to', () => {
    for (const n of nudges()) {
      if (n.zoom === undefined || n.zoom === 1) continue
      expect(
        n.x !== undefined || n.y !== undefined,
        `${n.playerId} zooms but gives no centre, so it just crops the middle`,
      ).toBe(true)
    }
  })

  it('nudges are the exception: a better original beats a hand-tuned crop', () => {
    expect(nudges().length).toBeLessThanOrEqual(3)
  })
})
