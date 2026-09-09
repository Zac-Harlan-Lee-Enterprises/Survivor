import { beforeEach, describe, expect, it } from 'vitest'
import { evaluateSeason, findStanding } from '@domain/index'
import { kickoffFor, scenario } from '@domain/testing/scenario'
import { createHarness, type Harness } from '../testing/harness'

/**
 * API/service tests: the rules are enforced server-side, picks are redacted
 * server-side, and writes are conditional. All in-memory, no AWS.
 */

const NOW = kickoffFor(2, -24) // Saturday before week 2

function baseSnapshot() {
  return scenario()
    .player('commish', { role: 'commissioner' })
    .players('ann', 'bob')
    .game(1, 'GB', 'CHI', { final: 'GB' })
    .game(1, 'KC', 'DEN', { final: 'DEN' })
    .game(2, 'KC', 'DEN', { kickoff: kickoffFor(2, 0) })
    .game(2, 'DAL', 'PHI', { kickoff: kickoffFor(2, 7) })
    .game(2, 'SF', 'SEA', { kickoff: kickoffFor(2, 7) })
    .game(2, 'GB', 'MIN', { kickoff: kickoffFor(2, 7) })
    .pick('ann', 1, 'GB')
    .pick('bob', 1, 'KC')
    .pick('commish', 1, 'GB')
    .pick('bob', 2, 'DAL')
    .build()
}

describe('authentication and identity', () => {
  let h: Harness
  beforeEach(async () => {
    h = await createHarness(baseSnapshot(), NOW)
  })

  it('links a first-time Cognito identity to a player by email, then by sub', async () => {
    const r = await h.call('GET', '/me', { sub: 'sub-ann', email: 'ANN@example.com' })
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ playerId: 'ann', displayName: 'ann', isCommissioner: false })
    // Second call with a different email still resolves by the stored link.
    const again = await h.call('GET', '/me', { sub: 'sub-ann', email: 'other@example.com' })
    expect(again.body.playerId).toBe('ann')
    const c = await h.call('GET', '/me', { sub: 'sub-c', email: 'commish@example.com' })
    expect(c.body.isCommissioner).toBe(true)
  })

  it('rejects unknown identities and anonymous writes', async () => {
    expect(
      (await h.call('GET', '/me', { sub: 'nobody', email: 'nobody@example.com' })).status,
    ).toBe(401)
    expect(
      (await h.call('PUT', '/seasons/season-1/picks/2', { body: { teamId: 'KC' } })).status,
    ).toBe(401)
  })
})

describe('/public prefix (no authorizer on API Gateway)', () => {
  it('serves anonymous GETs, ignores any identity, and refuses writes', async () => {
    const h = await createHarness(baseSnapshot(), NOW)
    const anon = await h.call('GET', '/public/seasons/season-1/snapshot')
    expect(anon.status).toBe(200)
    expect(anon.body.hiddenPicks).toEqual([{ playerId: 'bob', week: 2 }])
    // Even with claims present, /public is always anonymous.
    const withToken = await h.call('GET', '/public/seasons/season-1/snapshot', {
      sub: 'sub-c',
      email: 'commish@example.com',
    })
    expect(withToken.body.hiddenPicks).toEqual([{ playerId: 'bob', week: 2 }])
    expect(
      (await h.call('PUT', '/public/seasons/season-1/picks/2', { body: { teamId: 'KC' } })).status,
    ).toBe(405)
    expect((await h.call('GET', '/public/nfl/teams')).body).toHaveLength(32)
  })
})

describe('snapshot redaction', () => {
  it('hides other players’ unlocked picks from players and anonymous viewers, not from the commissioner', async () => {
    const h = await createHarness(baseSnapshot(), NOW)
    const anon = await h.call('GET', '/seasons/season-1/snapshot')
    expect(anon.status).toBe(200)
    expect(anon.body.picks.map((p: { id: string }) => p.id).sort()).toEqual([
      'p-ann-1',
      'p-bob-1',
      'p-commish-1',
    ])
    expect(anon.body.hiddenPicks).toEqual([{ playerId: 'bob', week: 2 }])

    const bob = await h.call('GET', '/seasons/season-1/snapshot', {
      sub: 'sub-bob',
      email: 'bob@example.com',
    })
    expect(bob.body.picks.some((p: { id: string }) => p.id === 'p-bob-2')).toBe(true)

    const commish = await h.call('GET', '/seasons/season-1/snapshot', {
      sub: 'sub-c',
      email: 'commish@example.com',
    })
    expect(commish.body.picks).toHaveLength(4)
    expect(commish.body.hiddenPicks).toEqual([])
    // Emails never leave the server.
    expect(JSON.stringify(commish.body)).not.toContain('@example.com')
  })
})

describe('PUT /seasons/:id/picks/:week (player)', () => {
  let h: Harness
  beforeEach(async () => {
    h = await createHarness(baseSnapshot(), NOW)
  })
  const ann = { sub: 'sub-ann', email: 'ann@example.com' }

  it('accepts a valid pick and audits it', async () => {
    const r = await h.call('PUT', '/seasons/season-1/picks/2', { ...ann, body: { teamId: 'kc' } })
    expect(r.status).toBe(200)
    expect(r.body.ok).toBe(true)
    expect(r.body.pick).toMatchObject({
      playerId: 'ann',
      week: 2,
      teamId: 'KC',
      gameId: 'g-2-DEN-KC',
      version: 1,
      source: 'player',
    })
    const audit = await h.repo.listAudit('league-1', 10)
    expect(audit[0]?.type).toBe('pick.submitted')
  })

  it('refuses a team already used (server-side, regardless of the client)', async () => {
    const r = await h.call('PUT', '/seasons/season-1/picks/2', { ...ann, body: { teamId: 'GB' } })
    expect(r.status).toBe(422)
    expect(r.body.violations.map((v: { code: string }) => v.code)).toContain('TEAM_ALREADY_USED')
  })

  it('refuses a pick after the deadline using the SERVER clock, for every game', async () => {
    // Just past the deadline (five minutes before the week's first kickoff).
    h.clock.now = new Date(kickoffFor(2, -4 / 60))
    const r = await h.call('PUT', '/seasons/season-1/picks/2', { ...ann, body: { teamId: 'KC' } })
    expect(r.status).toBe(422)
    expect(r.body.violations.map((v: { code: string }) => v.code)).toContain('WEEK_LOCKED')
    // A game hours later is locked too: the whole league locks together.
    const later = await h.call('PUT', '/seasons/season-1/picks/2', {
      ...ann,
      body: { teamId: 'SF' },
    })
    expect(later.status).toBe(422)
    expect(later.body.violations.map((v: { code: string }) => v.code)).toContain('WEEK_LOCKED')
  })

  it('still accepts a pick a minute before the deadline', async () => {
    h.clock.now = new Date(kickoffFor(2, -6 / 60))
    const r = await h.call('PUT', '/seasons/season-1/picks/2', { ...ann, body: { teamId: 'KC' } })
    expect(r.status).toBe(200)
  })

  it('refuses a bye team and unknown teams', async () => {
    expect(
      (await h.call('PUT', '/seasons/season-1/picks/2', { ...ann, body: { teamId: 'MIA' } })).body
        .violations[0].code,
    ).toBe('TEAM_NOT_PLAYING')
    expect(
      (await h.call('PUT', '/seasons/season-1/picks/2', { ...ann, body: { teamId: 'XYZ' } })).body
        .violations[0].code,
    ).toBe('TEAM_UNKNOWN')
  })

  it('changes a pick before kickoff with version tracking, and treats duplicate submissions as no-ops', async () => {
    const first = await h.call('PUT', '/seasons/season-1/picks/2', {
      ...ann,
      body: { teamId: 'KC' },
    })
    const dup = await h.call('PUT', '/seasons/season-1/picks/2', { ...ann, body: { teamId: 'KC' } })
    expect(dup.body.pick.version).toBe(1)
    const change = await h.call('PUT', '/seasons/season-1/picks/2', {
      ...ann,
      body: { teamId: 'SF', expectedVersion: first.body.pick.version },
    })
    expect(change.status).toBe(200)
    expect(change.body.pick).toMatchObject({ teamId: 'SF', version: 2 })
    const stale = await h.call('PUT', '/seasons/season-1/picks/2', {
      ...ann,
      body: { teamId: 'DAL', expectedVersion: 1 },
    })
    expect(stale.status).toBe(422)
    expect(stale.body.violations[0].code).toBe('VERSION_CONFLICT')
  })

  it('cannot change a pick whose game has already kicked off', async () => {
    await h.call('PUT', '/seasons/season-1/picks/2', { ...ann, body: { teamId: 'KC' } })
    h.clock.now = new Date(kickoffFor(2, 1))
    const r = await h.call('PUT', '/seasons/season-1/picks/2', {
      ...ann,
      body: { teamId: 'SF', expectedVersion: 1 },
    })
    expect(r.status).toBe(422)
    expect(r.body.violations.map((v: { code: string }) => v.code)).toContain('EXISTING_PICK_LOCKED')
  })

  it('a racing write loses cleanly (409) instead of clobbering', async () => {
    await h.call('PUT', '/seasons/season-1/picks/2', { ...ann, body: { teamId: 'KC' } })
    // Simulate another tab bumping the version between validation and write.
    const pick = (await h.repo.listPicks('season-1')).find((p) => p.id === 'pick-ann-2')!
    const original = h.repo.savePick.bind(h.repo)
    h.repo.savePick = async (p, prev) => {
      await h.repo.forcePick({ ...pick, version: 5 })
      return original(p, prev)
    }
    const r = await h.call('PUT', '/seasons/season-1/picks/2', {
      ...ann,
      body: { teamId: 'SF', expectedVersion: 1 },
    })
    expect(r.status).toBe(409)
    expect(r.body.violations[0].code).toBe('VERSION_CONFLICT')
  })

  it('an eliminated player cannot pick', async () => {
    const snap = scenario()
      .player('commish', { role: 'commissioner' })
      .player('out', { livesOverride: 1 })
      .game(1, 'GB', 'CHI', { final: 'CHI' })
      .game(2, 'KC', 'DEN', { kickoff: kickoffFor(2, 0) })
      .pick('out', 1, 'GB')
      .build()
    const h2 = await createHarness(snap, NOW)
    const r = await h2.call('PUT', '/seasons/season-1/picks/2', {
      sub: 's',
      email: 'out@example.com',
      body: { teamId: 'KC' },
    })
    expect(r.body.violations[0].code).toBe('PLAYER_ELIMINATED')
  })
})

describe('commissioner routes', () => {
  let h: Harness
  const commish = { sub: 'sub-c', email: 'commish@example.com' }
  const ann = { sub: 'sub-ann', email: 'ann@example.com' }
  beforeEach(async () => {
    h = await createHarness(baseSnapshot(), NOW)
  })

  it('protects commissioner operations on the API itself', async () => {
    expect(
      (
        await h.call('PUT', '/seasons/season-1/players/bob/picks/2', {
          ...ann,
          body: { teamId: 'KC', reason: 'x' },
        })
      ).status,
    ).toBe(403)
    expect(
      (
        await h.call('POST', '/leagues/league-1/games/g-1-CHI-GB/override', {
          ...ann,
          body: { status: 'final', winnerTeamId: 'CHI', reason: 'x' },
        })
      ).status,
    ).toBe(403)
    expect((await h.call('GET', '/leagues/league-1/audit', ann)).status).toBe(403)
    expect(
      (
        await h.call('PUT', '/leagues/league-1/settings', {
          ...ann,
          body: { settings: {}, reason: 'x' },
        })
      ).status,
    ).toBe(403)
  })

  it('commissioner can set a pick after kickoff (audited, recorded as override)', async () => {
    h.clock.now = new Date(kickoffFor(2, 2))
    const r = await h.call('PUT', '/seasons/season-1/players/ann/picks/2', {
      ...commish,
      body: { teamId: 'KC', reason: 'texted before kickoff' },
    })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ playerId: 'ann', teamId: 'KC', source: 'commissioner' })
    const overrides = await h.call('GET', '/seasons/season-1/overrides', commish)
    expect(overrides.body[0]).toMatchObject({
      type: 'pick',
      reason: 'texted before kickoff',
      actorPlayerId: 'commish',
    })
  })

  it('a result correction recalculates standings and later provider updates cannot undo it', async () => {
    // Bob lost week 1 on KC (DEN won). Flip it.
    const before = await h.call('GET', '/seasons/season-1/snapshot', commish)
    expect(findStanding(evaluateSeason(before.body, { now: NOW }), 'bob')?.livesRemaining).toBe(2)
    const r = await h.call('POST', '/leagues/league-1/games/g-1-DEN-KC/override', {
      ...commish,
      body: { status: 'final', homeScore: 30, awayScore: 27, reason: 'stat correction' },
    })
    expect(r.status).toBe(200)
    expect(r.body.winnerTeamId).toBe('KC')
    const after = await h.call('GET', '/seasons/season-1/snapshot', commish)
    expect(findStanding(evaluateSeason(after.body, { now: NOW }), 'bob')?.livesRemaining).toBe(3)
    // Contradictory winner/score is rejected by the domain.
    const bad = await h.call('POST', '/leagues/league-1/games/g-1-DEN-KC/override', {
      ...commish,
      body: { status: 'final', homeScore: 30, awayScore: 27, winnerTeamId: 'DEN', reason: 'oops' },
    })
    expect(bad.status).toBe(500)
    // Clearing restores the provider result.
    await h.call('DELETE', '/leagues/league-1/games/g-1-DEN-KC/override', {
      ...commish,
      body: { reason: 'nvm' },
    })
    const restored = await h.call('GET', '/seasons/season-1/snapshot', commish)
    expect(findStanding(evaluateSeason(restored.body, { now: NOW }), 'bob')?.livesRemaining).toBe(2)
  })

  it('settings, members, decisions and imports are validated and audited', async () => {
    const settings = await h.call('PUT', '/leagues/league-1/settings', {
      ...commish,
      body: { settings: { defaultLives: 2 }, reason: 'league vote' },
    })
    expect(settings.status).toBe(200)
    expect(settings.body.settings.defaultLives).toBe(2)
    expect(settings.body.settings.tieCountsAsMiss).toBe(true)

    const added = await h.call('POST', '/seasons/season-1/members', {
      ...commish,
      body: { displayName: 'Zoë Q.', email: 'zoe@example.com' },
    })
    expect(added.status).toBe(201)
    expect(added.body.membership.playerId).toBe('zoe-q')
    const me = await h.call('GET', '/me', { sub: 'sub-zoe', email: 'zoe@example.com' })
    expect(me.body.playerId).toBe('zoe-q')

    const patched = await h.call('PATCH', `/members/${added.body.membership.id}`, {
      ...commish,
      body: { status: 'inactive', livesOverride: 4, reason: 'joined late' },
    })
    expect(patched.body).toMatchObject({ status: 'inactive', livesOverride: 4 })

    const badDecision = await h.call('POST', '/seasons/season-1/decision', {
      ...commish,
      body: { championPlayerIds: ['ghost'], reason: 'x' },
    })
    expect(badDecision.status).toBe(400)
    const decision = await h.call('POST', '/seasons/season-1/decision', {
      ...commish,
      body: { championPlayerIds: ['ann'], reason: 'tiebreaker' },
    })
    expect(decision.status).toBe(200)
    const snap = await h.call('GET', '/seasons/season-1/snapshot', commish)
    expect(evaluateSeason(snap.body, { now: NOW }).championIds).toEqual(['ann'])

    const imported = await h.call('POST', '/seasons/season-1/picks/import', {
      ...commish,
      body: {
        reason: 'sheet',
        picks: [
          {
            id: 'x',
            leagueId: 'league-1',
            seasonId: 'season-1',
            playerId: 'ann',
            week: 2,
            teamId: 'SF',
            gameId: 'g-2-SEA-SF',
            submittedAt: NOW,
            updatedAt: NOW,
            version: 1,
            source: 'import',
          },
          {
            id: 'y',
            leagueId: 'league-1',
            seasonId: 'season-1',
            playerId: 'stranger',
            week: 2,
            teamId: 'SF',
            gameId: 'g-2-SEA-SF',
            submittedAt: NOW,
            updatedAt: NOW,
            version: 1,
            source: 'import',
          },
        ],
      },
    })
    expect(imported.body).toEqual({ imported: 1 })
    const audit = await h.call('GET', '/leagues/league-1/audit', commish)
    expect(audit.body.map((e: { type: string }) => e.type)).toContain('picks.imported')
  })
})
