import { describe, expect, it } from 'vitest'
import {
  ALL_TEAM_IDS,
  NFL_TEAMS,
  getTeam,
  lookupTeam,
  readableTextColor,
  requireTeam,
} from './teams'
import { NFLTeamSchema } from './models'

describe('NFL teams', () => {
  it('has exactly 32 unique, schema-valid teams split 16/16 by conference', () => {
    expect(NFL_TEAMS).toHaveLength(32)
    expect(new Set(ALL_TEAM_IDS).size).toBe(32)
    for (const t of NFL_TEAMS) expect(() => NFLTeamSchema.parse(t)).not.toThrow()
    expect(NFL_TEAMS.filter((t) => t.conference === 'AFC')).toHaveLength(16)
    const divisions = new Map<string, number>()
    for (const t of NFL_TEAMS)
      divisions.set(
        `${t.conference}-${t.division}`,
        (divisions.get(`${t.conference}-${t.division}`) ?? 0) + 1,
      )
    expect([...divisions.values()].every((n) => n === 4)).toBe(true)
  })

  it('looks teams up by id, nickname, city, alias — case-insensitively', () => {
    expect(lookupTeam('gb')).toEqual({ kind: 'match', teamId: 'GB' })
    expect(lookupTeam('Packers')).toEqual({ kind: 'match', teamId: 'GB' })
    expect(lookupTeam('green bay')).toEqual({ kind: 'match', teamId: 'GB' })
    expect(lookupTeam('GNB')).toEqual({ kind: 'match', teamId: 'GB' })
    expect(lookupTeam('49ers')).toEqual({ kind: 'match', teamId: 'SF' })
    expect(lookupTeam('WSH')).toEqual({ kind: 'match', teamId: 'WAS' })
    expect(lookupTeam('JAC')).toEqual({ kind: 'match', teamId: 'JAX' })
  })

  it('reports ambiguity instead of guessing', () => {
    expect(lookupTeam('Los Angeles')).toEqual({ kind: 'ambiguous', candidates: ['LAC', 'LAR'] })
    expect(lookupTeam('New York')).toEqual({ kind: 'ambiguous', candidates: ['NYG', 'NYJ'] })
    expect(lookupTeam('Wolves')).toEqual({ kind: 'unknown' })
    expect(lookupTeam('')).toEqual({ kind: 'unknown' })
  })

  it('getTeam / requireTeam', () => {
    expect(getTeam('kc')?.fullName).toBe('Kansas City Chiefs')
    expect(getTeam('XX')).toBeUndefined()
    expect(() => requireTeam('XX')).toThrow(/Unknown NFL team/)
  })

  it('picks readable text colours', () => {
    expect(readableTextColor('#FFB612')).toBe('#0b1020')
    expect(readableTextColor('#203731')).toBe('#ffffff')
  })
})
