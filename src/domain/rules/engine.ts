import type {
  LeagueGameOverride,
  LeagueMembership,
  LeagueSettings,
  NFLGame,
  Pick,
  PickOutcome,
  SeasonSnapshot,
} from '../models'
import { ALL_TEAM_IDS } from '../teams'
import { maxDate, minDate, toDate } from '../time'

/**
 * Deterministic survivor rules engine.
 *
 * Everything here is a pure function of (snapshot, now). Strikes, lives,
 * eliminations, teams used, standings and champions are DERIVED from picks and
 * game results every time — nothing mutable is stored, so a corrected result
 * or an overridden pick automatically recalculates the whole season.
 *
 * Rules (see AGENTS.md → Survivor rules):
 *   - One pick per week; a win costs nothing; a loss OR a tie costs one life.
 *   - Players start with settings.defaultLives (3). Third miss = eliminated.
 *   - A team used in an earlier (locked/resolved) week cannot be used again.
 *   - No pick when the week's last game kicks off = a miss.
 *   - Cancelled game: pick is void (team returns to pool) unless configured.
 *   - Last player standing is champion. Everyone out in the same week →
 *     co-champions or commissioner decision, per league settings.
 */

export type WeekPhase = 'no-data' | 'upcoming' | 'open' | 'locked' | 'final'

export interface WeekSummary {
  week: number
  phase: WeekPhase
  isCurrent: boolean
  firstKickoffAt: string | null
  lastKickoffAt: string | null
  /** The pick deadline: once the last game has kicked off no pick can be made. */
  deadlineAt: string | null
  gamesTotal: number
  gamesFinal: number
  gamesCancelled: number
  /** False when no game can be played (no data, or everything cancelled). */
  requiresPick: boolean
  /** Every player who entered the week alive has a non-pending outcome. */
  settled: boolean
}

export interface PlayerWeekResult {
  week: number
  pick: Pick | null
  game: NFLGame | null
  outcome: PickOutcome
  consumedLife: boolean
  livesAfter: number
  /** The pick can no longer be changed (game kicked off / finished). */
  locked: boolean
  eliminatedHere: boolean
}

export type SurvivorStatus =
  'alive' | 'eliminated' | 'champion' | 'co-champion' | 'finalist' | 'inactive'

export interface PlayerStanding {
  playerId: string
  membership: LeagueMembership
  status: SurvivorStatus
  livesTotal: number
  livesRemaining: number
  strikes: number
  eliminatedWeek: number | null
  weeksSurvived: number
  wins: number
  /** Consecutive wins ending at the most recent resolved week. */
  streak: number
  teamsUsed: string[]
  teamsRemaining: string[]
  currentPick: Pick | null
  currentOutcome: PickOutcome
  history: PlayerWeekResult[]
  /** Rank position among all standings (1-based) after sorting. */
  rank: number
}

export interface SeasonEvaluation {
  currentWeek: number
  weeks: WeekSummary[]
  standings: PlayerStanding[]
  aliveIds: string[]
  eliminatedIds: string[]
  championIds: string[]
  finalistIds: string[]
  isComplete: boolean
  /** Week in which the season was decided, if it has been. */
  decidedWeek: number | null
  evaluatedAt: string
}

export interface EvaluateOptions {
  now: Date | string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function applyGameOverrides(games: NFLGame[], overrides: LeagueGameOverride[]): NFLGame[] {
  if (overrides.length === 0) return games
  const byGame = new Map(overrides.map((o) => [o.gameId, o]))
  return games.map((game) => {
    const o = byGame.get(game.id)
    if (!o) return game
    return {
      ...game,
      status: o.status,
      homeScore: o.homeScore,
      awayScore: o.awayScore,
      winnerTeamId: o.winnerTeamId,
      resultSource: 'commissioner',
      updatedAt: o.createdAt,
    }
  })
}

export function gameInvolves(game: NFLGame, teamId: string): boolean {
  return game.homeTeamId === teamId || game.awayTeamId === teamId
}

export function opponentOf(game: NFLGame, teamId: string): string {
  return game.homeTeamId === teamId ? game.awayTeamId : game.homeTeamId
}

export function hasKickedOff(game: NFLGame, now: Date): boolean {
  if (game.status === 'final' || game.status === 'in_progress') return true
  if (game.status === 'cancelled') return false
  return toDate(game.kickoffAt).getTime() <= now.getTime()
}

export function isPickLocked(game: NFLGame | null, now: Date): boolean {
  if (!game) return false
  return hasKickedOff(game, now)
}

/** Does this outcome permanently consume the team for the season? */
export function outcomeConsumesTeam(outcome: PickOutcome, locked: boolean): boolean {
  switch (outcome) {
    case 'win':
    case 'loss':
    case 'tie':
      return true
    case 'pending':
      return locked
    case 'void':
    case 'missing':
    case 'not_required':
      return false
  }
}

export function livesForMember(membership: LeagueMembership, settings: LeagueSettings): number {
  return membership.livesOverride ?? settings.defaultLives
}

function outcomeForGame(game: NFLGame, teamId: string, settings: LeagueSettings): PickOutcome {
  switch (game.status) {
    case 'final':
      if (game.winnerTeamId === teamId) return 'win'
      if (game.winnerTeamId === null || game.winnerTeamId === undefined) return 'tie'
      return 'loss'
    case 'cancelled':
      return settings.cancelledGamePolicy === 'void' ? 'void' : 'missing'
    case 'scheduled':
    case 'in_progress':
    case 'postponed':
      return 'pending'
  }
}

function outcomeCostsLife(outcome: PickOutcome, settings: LeagueSettings): boolean {
  switch (outcome) {
    case 'loss':
      return true
    case 'tie':
      return settings.tieCountsAsMiss
    case 'missing':
      return settings.missingPickCountsAsMiss
    default:
      return false
  }
}

function isResolved(outcome: PickOutcome): boolean {
  return outcome !== 'pending'
}

export function summarizeWeek(
  week: number,
  games: NFLGame[],
  now: Date,
): Omit<WeekSummary, 'isCurrent' | 'settled'> {
  const live = games.filter((g) => g.status !== 'cancelled')
  const kickoffs = live.map((g) => g.kickoffAt)
  const first = minDate(kickoffs)
  const last = maxDate(kickoffs)
  const gamesFinal = games.filter((g) => g.status === 'final').length
  const gamesCancelled = games.filter((g) => g.status === 'cancelled').length

  let phase: WeekPhase
  if (games.length === 0) phase = 'no-data'
  else if (live.length === 0 || gamesFinal === live.length) phase = 'final'
  else if (last && now.getTime() >= last.getTime()) phase = 'locked'
  else phase = 'open'

  return {
    week,
    phase,
    firstKickoffAt: first ? first.toISOString() : null,
    lastKickoffAt: last ? last.toISOString() : null,
    deadlineAt: last ? last.toISOString() : null,
    gamesTotal: games.length,
    gamesFinal,
    gamesCancelled,
    requiresPick: live.length > 0,
  }
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

export function evaluateSeason(
  snapshot: SeasonSnapshot,
  options: EvaluateOptions,
): SeasonEvaluation {
  const now = toDate(options.now)
  const { season, league } = snapshot
  const settings = league.settings
  const games = applyGameOverrides(snapshot.games, snapshot.gameOverrides ?? [])
  const gamesById = new Map(games.map((g) => [g.id, g]))
  const gamesByWeek = new Map<number, NFLGame[]>()
  for (const g of games) {
    if (g.seasonYear !== season.year) continue
    const list = gamesByWeek.get(g.week) ?? []
    list.push(g)
    gamesByWeek.set(g.week, list)
  }

  const weekNumbers: number[] = []
  for (let w = season.startWeek; w <= season.endWeek; w++) weekNumbers.push(w)

  const baseWeeks = weekNumbers.map((w) => summarizeWeek(w, gamesByWeek.get(w) ?? [], now))

  // Current week: first week that is not final. Weeks with no data still count
  // as "current" so the UI can say the schedule has not loaded, rather than
  // silently skipping ahead and striking everyone.
  let currentWeek = season.endWeek
  for (const ws of baseWeeks) {
    if (ws.phase !== 'final') {
      currentWeek = ws.week
      break
    }
  }
  // Upcoming = beyond the current week.
  for (const ws of baseWeeks) {
    if (ws.week > currentWeek && ws.phase !== 'no-data') ws.phase = 'upcoming'
  }

  const activeMembers = snapshot.memberships.filter((m) => m.status === 'active')
  const inactiveMembers = snapshot.memberships.filter((m) => m.status !== 'active')
  const picksByPlayerWeek = new Map<string, Pick>()
  for (const p of snapshot.picks) {
    if (p.seasonId !== season.id) continue
    picksByPlayerWeek.set(`${p.playerId}:${p.week}`, p)
  }

  interface Acc {
    membership: LeagueMembership
    livesTotal: number
    strikes: number
    eliminatedWeek: number | null
    history: PlayerWeekResult[]
  }
  const acc = new Map<string, Acc>(
    activeMembers.map((m) => [
      m.playerId,
      {
        membership: m,
        livesTotal: livesForMember(m, settings),
        strikes: 0,
        eliminatedWeek: null,
        history: [],
      },
    ]),
  )

  const weekSummaries: WeekSummary[] = []
  let championIds: string[] = []
  let finalistIds: string[] = []
  let decidedWeek: number | null = null

  const decision = snapshot.decision ?? null

  for (const ws of baseWeeks) {
    const weekGames = gamesByWeek.get(ws.week) ?? []
    const decidedBefore = decidedWeek !== null
    let settled = true
    const enteredAlive: string[] = []

    for (const [playerId, a] of acc) {
      const alreadyOut = a.eliminatedWeek !== null
      if (alreadyOut || decidedBefore) {
        a.history.push({
          week: ws.week,
          pick: picksByPlayerWeek.get(`${playerId}:${ws.week}`) ?? null,
          game: null,
          outcome: 'not_required',
          consumedLife: false,
          livesAfter: Math.max(a.livesTotal - a.strikes, 0),
          locked: true,
          eliminatedHere: false,
        })
        continue
      }
      enteredAlive.push(playerId)

      const pick = picksByPlayerWeek.get(`${playerId}:${ws.week}`) ?? null
      const game = pick
        ? (gamesById.get(pick.gameId) ??
          weekGames.find((g) => gameInvolves(g, pick.teamId)) ??
          null)
        : null

      let outcome: PickOutcome
      if (ws.phase === 'no-data' || !ws.requiresPick) {
        // Nothing could be played this week — nobody owes a pick.
        outcome = 'not_required'
      } else if (ws.phase === 'upcoming') {
        outcome = 'pending'
      } else if (!pick) {
        outcome = ws.phase === 'open' ? 'pending' : 'missing'
      } else if (!game) {
        // Pick references a game we no longer know about (provider changed ids):
        // treat as pending so nobody is struck by a data glitch.
        outcome = 'pending'
      } else {
        outcome = outcomeForGame(game, pick.teamId, settings)
      }

      const locked = game ? isPickLocked(game, now) : ws.phase === 'locked' || ws.phase === 'final'
      const consumedLife = outcomeCostsLife(outcome, settings)
      if (consumedLife) a.strikes += 1
      const eliminatedHere = consumedLife && a.strikes >= a.livesTotal
      if (eliminatedHere) a.eliminatedWeek = ws.week
      if (!isResolved(outcome)) settled = false

      a.history.push({
        week: ws.week,
        pick,
        game,
        outcome,
        consumedLife,
        livesAfter: Math.max(a.livesTotal - a.strikes, 0),
        locked,
        eliminatedHere,
      })
    }

    const weekSettled = settled && ws.phase !== 'upcoming' && ws.phase !== 'no-data'
    weekSummaries.push({ ...ws, isCurrent: ws.week === currentWeek, settled: weekSettled })

    // Crown logic — only on a settled week, only once.
    if (decidedWeek === null && enteredAlive.length > 0 && weekSettled) {
      const stillAlive = enteredAlive.filter((id) => acc.get(id)!.eliminatedWeek === null)
      const outThisWeek = enteredAlive.filter((id) => acc.get(id)!.eliminatedWeek === ws.week)
      const participants = acc.size

      if (stillAlive.length === 1 && participants >= 2 && outThisWeek.length > 0) {
        championIds = [...stillAlive]
        decidedWeek = ws.week
      } else if (stillAlive.length === 0 && outThisWeek.length > 0) {
        finalistIds = [...outThisWeek]
        decidedWeek = ws.week
        if (settings.simultaneousEliminationPolicy === 'co-champions')
          championIds = [...outThisWeek]
      } else if (ws.week === season.endWeek && stillAlive.length >= 2) {
        finalistIds = [...stillAlive]
        decidedWeek = ws.week
        if (settings.simultaneousEliminationPolicy === 'co-champions') championIds = [...stillAlive]
      } else if (ws.week === season.endWeek && stillAlive.length === 1) {
        championIds = [...stillAlive]
        decidedWeek = ws.week
      }
    }
  }

  // A recorded commissioner decision always wins (tiebreakers, disputes).
  if (decision && decision.seasonId === season.id) {
    championIds = [...decision.championPlayerIds]
    if (decidedWeek === null) decidedWeek = currentWeek
  }

  const championSet = new Set(championIds)
  const finalistSet = new Set(finalistIds)

  const standings: PlayerStanding[] = []
  for (const [playerId, a] of acc) {
    const resolved = a.history.filter((h) => isResolved(h.outcome) && h.outcome !== 'not_required')
    const wins = resolved.filter((h) => h.outcome === 'win').length
    let streak = 0
    for (let i = resolved.length - 1; i >= 0; i--) {
      if (resolved[i]!.outcome === 'win') streak += 1
      else break
    }
    const teamsUsed = a.history
      .filter((h) => h.pick && outcomeConsumesTeam(h.outcome, h.locked))
      .map((h) => h.pick!.teamId)
    const usedSet = new Set(teamsUsed)
    const teamsRemaining = ALL_TEAM_IDS.filter((id) => !usedSet.has(id))
    const current = a.history.find((h) => h.week === currentWeek) ?? null

    let status: SurvivorStatus
    if (championSet.has(playerId)) status = championIds.length > 1 ? 'co-champion' : 'champion'
    else if (finalistSet.has(playerId) && championIds.length === 0) status = 'finalist'
    else if (a.eliminatedWeek !== null) status = 'eliminated'
    else status = 'alive'

    const weeksSurvived =
      a.eliminatedWeek !== null ? Math.max(a.eliminatedWeek - season.startWeek, 0) : resolved.length

    standings.push({
      playerId,
      membership: a.membership,
      status,
      livesTotal: a.livesTotal,
      livesRemaining: Math.max(a.livesTotal - a.strikes, 0),
      strikes: a.strikes,
      eliminatedWeek: a.eliminatedWeek,
      weeksSurvived,
      wins,
      streak,
      teamsUsed,
      teamsRemaining,
      currentPick: current?.pick ?? null,
      currentOutcome: current?.outcome ?? 'not_required',
      history: a.history,
      rank: 0,
    })
  }

  for (const m of inactiveMembers) {
    const livesTotal = livesForMember(m, settings)
    standings.push({
      playerId: m.playerId,
      membership: m,
      status: 'inactive',
      livesTotal,
      livesRemaining: livesTotal,
      strikes: 0,
      eliminatedWeek: null,
      weeksSurvived: 0,
      wins: 0,
      streak: 0,
      teamsUsed: [],
      teamsRemaining: [...ALL_TEAM_IDS],
      currentPick: null,
      currentOutcome: 'not_required',
      history: [],
      rank: 0,
    })
  }

  standings.sort(compareStandings)
  standings.forEach((s, i) => (s.rank = i + 1))

  const aliveIds = standings.filter((s) => s.status === 'alive').map((s) => s.playerId)
  const eliminatedIds = standings.filter((s) => s.status === 'eliminated').map((s) => s.playerId)

  return {
    currentWeek,
    weeks: weekSummaries,
    standings,
    aliveIds,
    eliminatedIds,
    championIds,
    finalistIds: championIds.length === 0 ? finalistIds : [],
    isComplete: championIds.length > 0,
    decidedWeek,
    evaluatedAt: now.toISOString(),
  }
}

const STATUS_ORDER: Record<SurvivorStatus, number> = {
  champion: 0,
  'co-champion': 0,
  finalist: 1,
  alive: 2,
  eliminated: 3,
  inactive: 4,
}

export function compareStandings(a: PlayerStanding, b: PlayerStanding): number {
  const so = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
  if (so !== 0) return so
  if (a.status === 'eliminated' && b.status === 'eliminated') {
    // Most recently eliminated first — the freshest drama tops the graveyard.
    const ew = (b.eliminatedWeek ?? 0) - (a.eliminatedWeek ?? 0)
    if (ew !== 0) return ew
  }
  if (a.strikes !== b.strikes) return a.strikes - b.strikes
  if (a.wins !== b.wins) return b.wins - a.wins
  return a.playerId.localeCompare(b.playerId)
}

export function findStanding(
  evaluation: SeasonEvaluation,
  playerId: string,
): PlayerStanding | undefined {
  return evaluation.standings.find((s) => s.playerId === playerId)
}

export function weekSummary(evaluation: SeasonEvaluation, week: number): WeekSummary | undefined {
  return evaluation.weeks.find((w) => w.week === week)
}
