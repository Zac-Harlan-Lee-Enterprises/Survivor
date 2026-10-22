import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import fixture from '@/data/demo/fixtures/demo-season.json'

it('the commissioner’s approved note reveals no player or NFL team', () => {
  const source = readFileSync(
    new URL('../../src/features/league-home/LeagueMessage.tsx', import.meta.url),
    'utf8',
  )
  const body = source.match(/body: '([^']+)'/)?.[1]
  expect(body).toBeTruthy()
  const words = new Set(body!.toLowerCase().split(/[^a-z0-9]+/))
  for (const profile of fixture.profiles) {
    expect(words.has(profile.displayName.split(' ')[0]!.toLowerCase())).toBe(false)
  }
  const teams = readFileSync(new URL('../../src/domain/teams.ts', import.meta.url), 'utf8')
  const entries = [...teams.matchAll(/\['([A-Z]+)', '([^']+)', '([^']+)'/g)]
  expect(entries).toHaveLength(32)
  const exactWords = new Set(body!.split(/[^a-zA-Z0-9]+/))
  for (const [, id, city, nickname] of entries) {
    expect(exactWords.has(id!)).toBe(false)
    expect(body!.toLowerCase()).not.toContain(city!.toLowerCase())
    expect(body!.toLowerCase()).not.toContain(nickname!.toLowerCase())
  }
})
