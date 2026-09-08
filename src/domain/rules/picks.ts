import type { LeagueSettings, NFLGame, NFLTeam, Pick, SeasonSnapshot } from '../models'
import { NFL_TEAMS, getTeam } from '../teams'
import { toDate } from '../time'
import {
  applyGameOverrides,
  findStanding,
  gameInvolves,
  hasKickedOff,
  opponentOf,
  weekSummary,
  type SeasonEvaluation,
} from './engine'

/**
 * Pick rules shared by the browser (to shape the UI) and the AWS backend (as
 * the authoritative gate). Disabled buttons are never the enforcement.
 */

export type PickViolationCode =
  | 'PLAYER_NOT_FOUND'
  | 'PLAYER_INACTIVE'
  | 'PLAYER_ELIMINATED'
  | 'SEASON_COMPLETE'
  | 'WEEK_NOT_OPEN'
  | 'NO_SCHEDULE'
  | 'TEAM_UNKNOWN'
  | 'TEAM_NOT_PLAYING'
  | 'GAME_CANCELLED'
  | 'GAME_STARTED'
  | 'TEAM_ALREADY_USED'
  | 'EXISTING_PICK_LOCKED'
  | 'VERSION_CONFLICT'

export interface PickViolation {
  code: PickViolationCode
  message: string
}

export interface PickRequest {
  playerId: string
  week: number
  teamId: string
  /** Version of the pick the client last saw; required when changing a pick. */
  expectedVersion?: number
}

export type PickValidation =
  | { ok: true; game: NFLGame; existing: Pick | null }
  | { ok: false; violations: PickViolation[]; existing: Pick | null }

export function validatePick(
  snapshot: SeasonSnapshot,
  evaluation: SeasonEvaluation,
  request: PickRequest,
  nowInput: Date | string,
): PickValidation {
  const now = toDate(nowInput)
  const violations: PickViolation[] = []
  const teamId = request.teamId.toUpperCase()
  const existing =
    snapshot.picks.find(
      (p) =>
        p.seasonId === snapshot.season.id &&
        p.playerId === request.playerId &&
        p.week === request.week,
    ) ?? null

  const standing = findStanding(evaluation, request.playerId)
  if (!standing) {
    return {
      ok: false,
      existing,
      violations: [{ code: 'PLAYER_NOT_FOUND', message: 'You are not a member of this season.' }],
    }
  }
  if (standing.status === 'inactive') {
    violations.push({
      code: 'PLAYER_INACTIVE',
      message: 'This membership is inactive. Ask the commissioner to reactivate you.',
    })
  }
  if (standing.status === 'eliminated') {
    violations.push({
      code: 'PLAYER_ELIMINATED',
      message: `You were eliminated in week ${standing.eliminatedWeek}. Picks are closed.`,
    })
  }
  if (evaluation.isComplete) {
    violations.push({
      code: 'SEASON_COMPLETE',
      message: 'The season has been decided. No more picks.',
    })
  }
  if (request.week !== evaluation.currentWeek) {
    violations.push({
      code: 'WEEK_NOT_OPEN',
      message: `Picks are only open for week ${evaluation.currentWeek}.`,
    })
  }
  const ws = weekSummary(evaluation, request.week)
  if (!ws || ws.phase === 'no-data') {
    violations.push({
      code: 'NO_SCHEDULE',
      message: 'The schedule for this week has not loaded yet.',
    })
  } else if (ws.phase === 'locked' || ws.phase === 'final') {
    violations.push({
      code: 'WEEK_NOT_OPEN',
      message: 'Every game this week has already kicked off.',
    })
  }

  if (!getTeam(teamId)) {
    violations.push({ code: 'TEAM_UNKNOWN', message: `"${request.teamId}" is not an NFL team.` })
    return { ok: false, violations, existing }
  }

  const games = applyGameOverrides(snapshot.games, snapshot.gameOverrides ?? []).filter(
    (g) => g.seasonYear === snapshot.season.year && g.week === request.week,
  )
  const game = games.find((g) => gameInvolves(g, teamId)) ?? null
  if (!game) {
    violations.push({
      code: 'TEAM_NOT_PLAYING',
      message: `${getTeam(teamId)!.fullName} do not play in week ${request.week} (bye).`,
    })
  } else if (game.status === 'cancelled') {
    violations.push({ code: 'GAME_CANCELLED', message: 'That game has been cancelled.' })
  } else if (hasKickedOff(game, now)) {
    violations.push({ code: 'GAME_STARTED', message: 'That game has already kicked off.' })
  }

  // Team reuse: any team consumed in another week is off the table.
  const usedElsewhere = standing.history.find(
    (h) =>
      h.week !== request.week && h.pick?.teamId === teamId && standing.teamsUsed.includes(teamId),
  )
  if (usedElsewhere) {
    violations.push({
      code: 'TEAM_ALREADY_USED',
      message: `You already rode with ${getTeam(teamId)!.name} in week ${usedElsewhere.week}.`,
    })
  }

  if (existing) {
    const existingGame = snapshot.games.find((g) => g.id === existing.gameId) ?? null
    if (existingGame && hasKickedOff(existingGame, now)) {
      violations.push({
        code: 'EXISTING_PICK_LOCKED',
        message: 'Your current pick has already kicked off and is locked.',
      })
    }
    if (request.expectedVersion !== undefined && request.expectedVersion !== existing.version) {
      violations.push({
        code: 'VERSION_CONFLICT',
        message: 'Your pick changed somewhere else. Refresh and try again.',
      })
    }
  }

  if (violations.length > 0 || !game) return { ok: false, violations, existing }
  return { ok: true, game, existing }
}

// ---------------------------------------------------------------------------
// Team availability for the pick screen / "My Season"
// ---------------------------------------------------------------------------

export type TeamAvailability =
  'available' | 'selected' | 'used' | 'bye' | 'locked' | 'cancelled' | 'postponed'

export interface TeamOption {
  team: NFLTeam
  state: TeamAvailability
  game: NFLGame | null
  opponentId: string | null
  isHome: boolean | null
  kickoffAt: string | null
  usedWeek: number | null
}

export function getTeamOptions(
  snapshot: SeasonSnapshot,
  evaluation: SeasonEvaluation,
  playerId: string,
  week: number,
  nowInput: Date | string,
): TeamOption[] {
  const now = toDate(nowInput)
  const standing = findStanding(evaluation, playerId)
  const games = applyGameOverrides(snapshot.games, snapshot.gameOverrides ?? []).filter(
    (g) => g.seasonYear === snapshot.season.year && g.week === week,
  )
  const currentPick = standing?.history.find((h) => h.week === week)?.pick ?? null
  const usedWeekByTeam = new Map<string, number>()
  for (const h of standing?.history ?? []) {
    if (h.pick && h.week !== week && standing!.teamsUsed.includes(h.pick.teamId)) {
      usedWeekByTeam.set(h.pick.teamId, h.week)
    }
  }

  return NFL_TEAMS.map((team) => {
    const game = games.find((g) => gameInvolves(g, team.id)) ?? null
    const usedWeek = usedWeekByTeam.get(team.id) ?? null
    let state: TeamAvailability
    if (currentPick?.teamId === team.id) state = 'selected'
    else if (usedWeek !== null) state = 'used'
    else if (!game) state = 'bye'
    else if (game.status === 'cancelled') state = 'cancelled'
    else if (game.status === 'postponed' && hasKickedOff(game, now)) state = 'postponed'
    else if (hasKickedOff(game, now)) state = 'locked'
    else state = 'available'

    return {
      team,
      state,
      game,
      opponentId: game ? opponentOf(game, team.id) : null,
      isHome: game ? game.homeTeamId === team.id : null,
      kickoffAt: game?.kickoffAt ?? null,
      usedWeek,
    }
  })
}

// ---------------------------------------------------------------------------
// Visibility: other players' picks stay hidden until they lock
// ---------------------------------------------------------------------------

export interface Viewer {
  playerId: string | null
  isCommissioner: boolean
}

export function isPickVisible(
  pick: Pick,
  game: NFLGame | null,
  viewer: Viewer,
  nowInput: Date | string,
  settings: LeagueSettings,
): boolean {
  if (viewer.isCommissioner) return true
  if (viewer.playerId && viewer.playerId === pick.playerId) return true
  if (!settings.hidePicksUntilLocked) return true
  if (!game) return false
  return hasKickedOff(game, toDate(nowInput))
}

/** Server-side redaction: strips picks the viewer must not see yet. */
export function redactPicks(snapshot: SeasonSnapshot, viewer: Viewer, now: Date | string): Pick[] {
  const games = new Map(snapshot.games.map((g) => [g.id, g]))
  return snapshot.picks.filter((p) =>
    isPickVisible(p, games.get(p.gameId) ?? null, viewer, now, snapshot.league.settings),
  )
}

/**
 * Redacts a whole snapshot for a viewer: hidden picks are removed and replaced
 * by (playerId, week) stubs so the UI can say "locked in" without revealing
 * the team. This is what the API returns and what demo mode mimics.
 */
export function redactSnapshot(
  snapshot: SeasonSnapshot,
  viewer: Viewer,
  now: Date | string,
): SeasonSnapshot {
  const visible = redactPicks(snapshot, viewer, now)
  const visibleIds = new Set(visible.map((p) => p.id))
  const hiddenPicks = snapshot.picks
    .filter((p) => !visibleIds.has(p.id))
    .map((p) => ({ playerId: p.playerId, week: p.week }))
  return { ...snapshot, picks: visible, hiddenPicks }
}
