import { describe, expect, it } from 'vitest'
import { SeasonSnapshotSchema, evaluateSeason } from '@/domain'
import fixture from './fixtures/demo-season.json'

/**
 * The seeded league is real data about real people, hand-transcribed from
 * Teams and Outlook messages each week. A typo here is not a cosmetic bug: it
 * shows someone a pick they did not make, or costs them a life they did not
 * lose. These invariants are what `validatePick` would have enforced had the
 * picks arrived through the app, applied to the seed instead.
 */
describe('demo fixture', () => {
  const snapshot = SeasonSnapshotSchema.parse(fixture)
  const gamesById = new Map(snapshot.games.map((g) => [g.id, g]))

  it('parses as a season snapshot', () => {
    expect(snapshot.profiles).toHaveLength(30)
    expect(snapshot.picks.length).toBeGreaterThan(0)
  })

  it('points every pick at a game that week in which the team actually plays', () => {
    for (const pick of snapshot.picks) {
      const game = gamesById.get(pick.gameId)
      expect(game, `${pick.playerId} week ${pick.week}: no such game ${pick.gameId}`).toBeDefined()
      expect(game?.week, `${pick.playerId} week ${pick.week}: game is week ${game?.week}`).toBe(
        pick.week,
      )
      const playing = game?.homeTeamId === pick.teamId || game?.awayTeamId === pick.teamId
      expect(playing, `${pick.playerId} week ${pick.week}: ${pick.teamId} is not in ${game?.id}`).toBe(
        true,
      )
    }
  })

  it('never reuses a team for the same player, and never double-picks a week', () => {
    const teamsUsed = new Map<string, Set<string>>()
    const weeksPicked = new Map<string, Set<number>>()
    for (const pick of [...snapshot.picks].sort((a, b) => a.week - b.week)) {
      const teams = teamsUsed.get(pick.playerId) ?? new Set()
      expect(
        teams.has(pick.teamId),
        `${pick.playerId} reused ${pick.teamId} in week ${pick.week}`,
      ).toBe(false)
      teams.add(pick.teamId)
      teamsUsed.set(pick.playerId, teams)

      const weeks = weeksPicked.get(pick.playerId) ?? new Set()
      expect(weeks.has(pick.week), `${pick.playerId} has two picks in week ${pick.week}`).toBe(false)
      weeks.add(pick.week)
      weeksPicked.set(pick.playerId, weeks)
    }
  })

  it('records every pick as submitted before that week’s deadline', () => {
    // Evaluated past the end of the season so every week has its deadline.
    const evaluation = evaluateSeason(snapshot, { now: '2027-03-01T00:00:00.000Z' })
    for (const pick of snapshot.picks) {
      const deadline = evaluation.weeks.find((w) => w.week === pick.week)?.deadlineAt
      expect(deadline, `week ${pick.week} has no deadline`).toBeTruthy()
      expect(
        new Date(pick.submittedAt).getTime(),
        `${pick.playerId} week ${pick.week} submitted ${pick.submittedAt}, after the ${deadline} deadline`,
      ).toBeLessThan(new Date(deadline as string).getTime())
    }
  })
})
