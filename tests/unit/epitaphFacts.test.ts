import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { eliminatedWeekOf, pinnedThrough, season } from './seasonFacts'

/**
 * Epitaphs are carved for real people, about real picks. Two ways that goes
 * wrong: burying someone who is still alive, and getting the facts of their
 * downfall wrong. This test guards the first for every epitaph; each epitaph
 * adds its own `it` below for the second, the same way the commissioner's
 * note does.
 *
 * Read from disk rather than imported: tests/unit is compiled by
 * tsconfig.node.json, which does not include src.
 */
const source = readFileSync(
  new URL('../../src/features/profile/epitaphs.ts', import.meta.url),
  'utf8',
)
const block = source.slice(source.indexOf('export const EPITAPHS'))

/** Each carved entry: who it is for, and the week it says put them there. */
const carved = [...block.matchAll(/'([a-z0-9-]+)':\s*\{[\s\S]*?writtenAfterWeek:\s*(\d+)/g)].map(
  (m) => ({ playerId: m[1]!, week: Number(m[2]) }),
)

describe('epitaphs bury only the dead', () => {
  it('reads the epitaph table it is guarding', () => {
    expect(block).toMatch(/^export const EPITAPHS: Record<string, Epitaph> = \{/)
    // Every key in the table was parsed, so nothing slips past the guard below.
    const keys = [...block.matchAll(/^\s{2}'([a-z0-9-]+)':/gm)].map((m) => m[1])
    expect(keys).toEqual(carved.map((c) => c.playerId))
  })

  it('carves a stone only for a player the pinned results actually eliminated, in that week', () => {
    for (const { playerId, week } of carved) {
      expect(
        season.profiles.some((p) => p.playerId === playerId),
        `${playerId} is not on the roster`,
      ).toBe(true)
      expect(
        eliminatedWeekOf(playerId, pinnedThrough),
        `${playerId}'s epitaph says week ${week}; pin that week's finals in seasonFacts first`,
      ).toBe(week)
    }
  })
})
