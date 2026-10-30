import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { nameOf, picksIn } from './seasonFacts'

/**
 * The commissioner's note states facts about the league to the people they are
 * about, so every claim in it is asserted here against the season. Week 8's
 * note is just "Good luck", so what is left to check is that it gives nothing
 * away about the week's picks.
 */
const WEEK = 8
const picks = picksIn(WEEK)

const source = readFileSync(
  new URL('../../src/features/league-home/LeagueMessage.tsx', import.meta.url),
  'utf8',
)
const body = source.slice(source.indexOf('const WEEK_8_PREVIEW'), source.indexOf('export function'))

/** Every way the note could name a team: abbreviation, city, nickname, aliases (src/domain/teams.ts). */
const teamNames = (() => {
  const src = readFileSync(new URL('../../src/domain/teams.ts', import.meta.url), 'utf8')
  const out = new Map<string, string[]>()
  for (const m of src.matchAll(/\['([A-Z]+)', '([^']+)', '([^']+)',[^\]]*\[([^\]]*)\]\]/g)) {
    const aliases = [...m[4]!.matchAll(/'([^']+)'/g)].map((a) => a[1]!)
    out.set(m[1]!, [m[1]!, m[2]!, m[3]!, ...aliases])
  }
  return out
})()

describe('the week 8 preview gives away nothing about week 8', () => {
  it('never names a player in the same sentence as the team they have picked for week 8', () => {
    expect(teamNames.size).toBe(32)
    expect(picks).toHaveLength(5)
    const sentences = body.split(/(?<=[.!?])\s+/)
    for (const p of picks) {
      const first = nameOf(p.playerId).split(' ')[0]!
      for (const s of sentences.filter((x) => new RegExp(`\\b${first}\\b`).test(x))) {
        for (const n of teamNames.get(p.teamId)!) {
          expect(new RegExp(`\\b${n}\\b`).test(s), `${first} beside ${n}: “${s}”`).toBe(false)
        }
      }
    }
  })

  it('says nothing about how the commissioner chased anyone for a pick', () => {
    expect(body).not.toMatch(/\b(messag|DM'?d|nudg|remind|chas)\w*/i)
  })

  it('never says how many share a team, or who is alone', () => {
    expect(body).not.toMatch(/\b(alone|same team|together|both|two of you|three of you)\b/i)
  })
})

describe('the week 8 note', () => {
  it('just says good luck', () => {
    expect(body).toMatch(/lines: \['Good luck\.'\]/)
  })
})
