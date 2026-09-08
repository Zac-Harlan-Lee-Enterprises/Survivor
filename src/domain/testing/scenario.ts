import type {
  LeagueGameOverride,
  LeagueMembership,
  LeagueSettings,
  NFLGame,
  NFLWeek,
  Pick,
  PlayerProfile,
  SeasonDecision,
  SeasonSnapshot,
} from '../models'
import { LeagueSettingsSchema } from '../models'
import { ALL_TEAM_IDS } from '../teams'

/**
 * Tiny scenario builder so rule tests read like the rulebook:
 *
 *   scenario()
 *     .players('ann', 'bob')
 *     .game(1, 'GB', 'CHI', { final: 'GB' })
 *     .pick('ann', 1, 'GB')
 *     .build()
 */

export const SEASON_YEAR = 2026
/** Week 1 Sunday 1pm ET (17:00Z). Weeks are 7 days apart. */
const WEEK1_SUNDAY = Date.UTC(2026, 8, 13, 17, 0, 0)

export function kickoffFor(week: number, offsetHours = 0): string {
  return new Date(
    WEEK1_SUNDAY + (week - 1) * 7 * 86_400_000 + offsetHours * 3_600_000,
  ).toISOString()
}

export interface GameSpec {
  kickoff?: string
  /** Team id, 'tie', or omit for scheduled */
  final?: string | 'tie'
  score?: [home: number, away: number]
  status?: NFLGame['status']
  id?: string
}

export class ScenarioBuilder {
  private settings: LeagueSettings = LeagueSettingsSchema.parse({})
  private memberships: LeagueMembership[] = []
  private profiles: PlayerProfile[] = []
  private picks: Pick[] = []
  private games: NFLGame[] = []
  private overrides: LeagueGameOverride[] = []
  private decision: SeasonDecision | null = null
  private endWeek = 18
  private startWeek = 1

  withSettings(partial: Partial<LeagueSettings>): this {
    this.settings = { ...this.settings, ...partial }
    return this
  }

  weeks(start: number, end: number): this {
    this.startWeek = start
    this.endWeek = end
    return this
  }

  players(...ids: string[]): this {
    for (const id of ids) this.player(id)
    return this
  }

  player(
    id: string,
    opts: {
      role?: LeagueMembership['role']
      status?: LeagueMembership['status']
      livesOverride?: number
    } = {},
  ): this {
    this.memberships.push({
      id: `m-${id}`,
      leagueId: 'league-1',
      seasonId: 'season-1',
      playerId: id,
      role: opts.role ?? 'player',
      status: opts.status ?? 'active',
      livesOverride: opts.livesOverride,
      joinedAt: '2026-08-01T00:00:00.000Z',
    })
    this.profiles.push({ playerId: id, displayName: id, imageId: null })
    return this
  }

  game(week: number, home: string, away: string, spec: GameSpec = {}): this {
    const id = spec.id ?? `g-${week}-${away}-${home}`
    const status: NFLGame['status'] = spec.status ?? (spec.final ? 'final' : 'scheduled')
    let winner: string | null | undefined
    let homeScore: number | undefined
    let awayScore: number | undefined
    if (spec.final) {
      winner = spec.final === 'tie' ? null : spec.final
      if (spec.score) [homeScore, awayScore] = spec.score
      else if (winner === null) [homeScore, awayScore] = [20, 20]
      else if (winner === home) [homeScore, awayScore] = [27, 17]
      else [homeScore, awayScore] = [17, 27]
    }
    this.games.push({
      id,
      seasonYear: SEASON_YEAR,
      week,
      homeTeamId: home,
      awayTeamId: away,
      kickoffAt: spec.kickoff ?? kickoffFor(week),
      status,
      homeScore,
      awayScore,
      winnerTeamId: winner,
      resultVersion: spec.final ? 1 : 0,
      resultSource: spec.final ? 'provider' : undefined,
      updatedAt: '2026-08-01T00:00:00.000Z',
    })
    return this
  }

  /** Fills the week with matchups so every team not listed as bye plays. */
  fullWeek(
    week: number,
    opts: { byes?: string[]; finals?: Record<string, string | 'tie'> } = {},
  ): this {
    const byes = new Set(opts.byes ?? [])
    const playing = ALL_TEAM_IDS.filter((t) => !byes.has(t))
    for (let i = 0; i + 1 < playing.length; i += 2) {
      const home = playing[i]!
      const away = playing[i + 1]!
      const finalHome = opts.finals?.[home]
      const finalAway = opts.finals?.[away]
      const final = finalHome ?? finalAway
      this.game(week, home, away, final ? { final: final === 'tie' ? 'tie' : final } : {})
    }
    return this
  }

  pick(playerId: string, week: number, teamId: string, opts: Partial<Pick> = {}): this {
    const game = this.games.find(
      (g) => g.week === week && (g.homeTeamId === teamId || g.awayTeamId === teamId),
    )
    this.picks.push({
      id: `p-${playerId}-${week}`,
      leagueId: 'league-1',
      seasonId: 'season-1',
      playerId,
      week,
      teamId,
      gameId: game?.id ?? `missing-${week}-${teamId}`,
      submittedAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
      version: 1,
      source: 'player',
      ...opts,
    })
    return this
  }

  override(
    gameId: string,
    o: Partial<LeagueGameOverride> & { status: LeagueGameOverride['status'] },
  ): this {
    this.overrides.push({
      leagueId: 'league-1',
      gameId,
      status: o.status,
      homeScore: o.homeScore,
      awayScore: o.awayScore,
      winnerTeamId: o.winnerTeamId,
      reason: o.reason ?? 'test override',
      actorPlayerId: o.actorPlayerId ?? 'commish',
      createdAt: o.createdAt ?? '2026-09-02T00:00:00.000Z',
    })
    return this
  }

  decide(championPlayerIds: string[]): this {
    this.decision = {
      seasonId: 'season-1',
      championPlayerIds,
      reason: 'test decision',
      actorPlayerId: 'commish',
      decidedAt: '2026-12-01T00:00:00.000Z',
    }
    return this
  }

  build(): SeasonSnapshot {
    const weeks: NFLWeek[] = []
    for (let w = this.startWeek; w <= this.endWeek; w++) {
      const playing = new Set<string>()
      for (const g of this.games) if (g.week === w) playing.add(g.homeTeamId).add(g.awayTeamId)
      weeks.push({
        seasonYear: SEASON_YEAR,
        week: w,
        label: `Week ${w}`,
        byeTeamIds: ALL_TEAM_IDS.filter((t) => !playing.has(t)),
      })
    }
    return {
      league: {
        id: 'league-1',
        name: 'Test League',
        createdAt: '2026-08-01T00:00:00.000Z',
        settings: this.settings,
        currentSeasonId: 'season-1',
      },
      season: {
        id: 'season-1',
        leagueId: 'league-1',
        year: SEASON_YEAR,
        label: 'Test Season',
        startWeek: this.startWeek,
        endWeek: this.endWeek,
        status: 'active',
        isSynthetic: true,
      },
      memberships: this.memberships,
      profiles: this.profiles,
      images: [],
      picks: this.picks,
      games: this.games,
      weeks,
      gameOverrides: this.overrides,
      decision: this.decision,
      hiddenPicks: [],
    }
  }
}

export function scenario(): ScenarioBuilder {
  return new ScenarioBuilder()
}
