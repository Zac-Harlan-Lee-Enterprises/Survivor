import {
  AuditEventSchema,
  CommissionerOverrideSchema,
  LeagueGameOverrideSchema,
  LeagueMembershipSchema,
  LeagueSchema,
  NFLGameSchema,
  NFLWeekSchema,
  PickSchema,
  PlayerImageSchema,
  PlayerProfileSchema,
  SeasonDecisionSchema,
  SeasonSchema,
  type AuditEvent,
  type CommissionerOverride,
  type League,
  type LeagueGameOverride,
  type LeagueMembership,
  type NFLGame,
  type NFLWeek,
  type Pick,
  type PlayerImage,
  type PlayerProfile,
  type Season,
  type SeasonDecision,
  type SeasonSnapshot,
} from '@domain/index'
import { K } from './keys'
import type { Item, TableStore } from './store'

/**
 * Typed access on top of the single table. Every read validates with the
 * domain schemas so a corrupt row fails loudly instead of poisoning standings.
 */

type Entity = Record<string, unknown>

function strip(item: Item): Entity {
  const { PK: _pk, SK: _sk, ...rest } = item
  return rest
}

export type StoredProfile = PlayerProfile & { email?: string }

export class LeagueRepo {
  private readonly store: TableStore

  constructor(store: TableStore) {
    this.store = store
  }

  // ---- leagues / seasons -------------------------------------------------
  async listLeagues(): Promise<League[]> {
    const rows = await this.store.query(K.leagues().PK, 'LEAGUE#')
    if (rows.length === 0) return []
    const leagues = await this.store.batchGet(rows.map((r) => K.league(String(r.leagueId))))
    return leagues.map((l) => LeagueSchema.parse(strip(l)))
  }

  async getLeague(leagueId: string): Promise<League | null> {
    const { PK, SK } = K.league(leagueId)
    const item = await this.store.get(PK, SK)
    return item ? LeagueSchema.parse(strip(item)) : null
  }

  async putLeague(league: League): Promise<void> {
    await this.store.put({ ...K.league(league.id), ...league })
    await this.store.put({ ...K.leagueIndex(league.id), leagueId: league.id })
  }

  async getSeason(leagueId: string, seasonId: string): Promise<Season | null> {
    const { PK, SK } = K.season(leagueId, seasonId)
    const item = await this.store.get(PK, SK)
    return item ? SeasonSchema.parse(strip(item)) : null
  }

  async putSeason(season: Season): Promise<void> {
    await this.store.put({ ...K.season(season.leagueId, season.id), ...season })
    await this.store.put({ ...K.seasonIndex(season.id), leagueId: season.leagueId })
  }

  /** Seasons are addressed by id alone from the API; the index row finds the league. */
  async findSeason(seasonId: string): Promise<Season | null> {
    const { PK, SK } = K.seasonIndex(seasonId)
    const idx = await this.store.get(PK, SK)
    if (!idx) return null
    return this.getSeason(String(idx.leagueId), seasonId)
  }

  // ---- people ------------------------------------------------------------
  async listMemberships(leagueId: string, seasonId: string): Promise<LeagueMembership[]> {
    const p = K.membersPrefix(leagueId, seasonId)
    return (await this.store.query(p.PK, p.prefix)).map((i) =>
      LeagueMembershipSchema.parse(strip(i)),
    )
  }

  async getMembership(
    leagueId: string,
    seasonId: string,
    playerId: string,
  ): Promise<LeagueMembership | null> {
    const { PK, SK } = K.member(leagueId, seasonId, playerId)
    const item = await this.store.get(PK, SK)
    return item ? LeagueMembershipSchema.parse(strip(item)) : null
  }

  async findMembershipById(
    leagueId: string,
    seasonId: string,
    membershipId: string,
  ): Promise<LeagueMembership | null> {
    return (
      (await this.listMemberships(leagueId, seasonId)).find((m) => m.id === membershipId) ?? null
    )
  }

  async putMembership(m: LeagueMembership): Promise<void> {
    await this.store.put({ ...K.member(m.leagueId, m.seasonId, m.playerId), ...m })
  }

  async getProfile(playerId: string): Promise<StoredProfile | null> {
    const { PK, SK } = K.profile(playerId)
    const item = await this.store.get(PK, SK)
    if (!item) return null
    const base = PlayerProfileSchema.parse(strip(item))
    return typeof item.email === 'string' ? { ...base, email: item.email } : base
  }

  async putProfile(profile: StoredProfile): Promise<void> {
    await this.store.put({ ...K.profile(profile.playerId), ...profile })
  }

  async listProfiles(playerIds: string[]): Promise<PlayerProfile[]> {
    if (playerIds.length === 0) return []
    const rows = await this.store.batchGet(playerIds.map((id) => K.profile(id)))
    return rows.map((i) => PlayerProfileSchema.parse(strip(i)))
  }

  async findPlayerByEmail(email: string, candidates: string[]): Promise<string | null> {
    if (candidates.length === 0) return null
    const rows = await this.store.batchGet(candidates.map((id) => K.profile(id)))
    const hit = rows.find(
      (r) => typeof r.email === 'string' && r.email.toLowerCase() === email.toLowerCase(),
    )
    return hit ? String(hit.playerId) : null
  }

  async getUserLink(sub: string): Promise<string | null> {
    const { PK, SK } = K.user(sub)
    const item = await this.store.get(PK, SK)
    return item ? String(item.playerId) : null
  }

  async putUserLink(sub: string, playerId: string): Promise<void> {
    await this.store.put({ ...K.user(sub), playerId })
  }

  async listImages(playerIds: string[]): Promise<PlayerImage[]> {
    const out: PlayerImage[] = []
    for (const id of playerIds) {
      const p = K.imagesPrefix(id)
      for (const i of await this.store.query(p.PK, p.prefix))
        out.push(PlayerImageSchema.parse(strip(i)))
    }
    return out
  }

  async putImage(image: PlayerImage): Promise<void> {
    await this.store.put({ ...K.image(image.playerId, image.id), ...image })
  }

  async deleteImage(playerId: string, imageId: string): Promise<void> {
    const { PK, SK } = K.image(playerId, imageId)
    await this.store.delete(PK, SK)
  }

  // ---- picks -------------------------------------------------------------
  async listPicks(seasonId: string): Promise<Pick[]> {
    const p = K.picksPrefix(seasonId)
    return (await this.store.query(p.PK, p.prefix)).map((i) => PickSchema.parse(strip(i)))
  }

  /** Conditional write: a new pick must not exist; a change must carry the version it replaces. */
  async savePick(pick: Pick, previousVersion: number | null): Promise<void> {
    const key = K.pick(pick.seasonId, pick.playerId, pick.week)
    if (previousVersion === null) await this.store.put({ ...key, ...pick }, { ifNotExists: true })
    else
      await this.store.put(
        { ...key, ...pick },
        { ifEquals: { attr: 'version', value: previousVersion } },
      )
  }

  /** Unconditional write for commissioner corrections and imports. */
  async forcePick(pick: Pick): Promise<void> {
    await this.store.put({ ...K.pick(pick.seasonId, pick.playerId, pick.week), ...pick })
  }

  async deletePick(seasonId: string, playerId: string, week: number): Promise<void> {
    const { PK, SK } = K.pick(seasonId, playerId, week)
    await this.store.delete(PK, SK)
  }

  async getDecision(seasonId: string): Promise<SeasonDecision | null> {
    const { PK, SK } = K.decision(seasonId)
    const item = await this.store.get(PK, SK)
    return item ? SeasonDecisionSchema.parse(strip(item)) : null
  }

  async putDecision(d: SeasonDecision): Promise<void> {
    await this.store.put({ ...K.decision(d.seasonId), ...d })
  }

  // ---- overrides & audit -------------------------------------------------
  async listGameOverrides(leagueId: string): Promise<LeagueGameOverride[]> {
    const p = K.gameOverridesPrefix(leagueId)
    return (await this.store.query(p.PK, p.prefix)).map((i) =>
      LeagueGameOverrideSchema.parse(strip(i)),
    )
  }

  async putGameOverride(o: LeagueGameOverride): Promise<void> {
    await this.store.put({ ...K.gameOverride(o.leagueId, o.gameId), ...o })
  }

  async deleteGameOverride(leagueId: string, gameId: string): Promise<void> {
    const { PK, SK } = K.gameOverride(leagueId, gameId)
    await this.store.delete(PK, SK)
  }

  async recordOverride(o: CommissionerOverride): Promise<void> {
    await this.store.put({ ...K.override(o.leagueId, o.createdAt, o.id), ...o })
  }

  async listOverrides(leagueId: string, seasonId: string): Promise<CommissionerOverride[]> {
    const p = K.overridesPrefix(leagueId)
    return (await this.store.query(p.PK, p.prefix, { descending: true }))
      .map((i) => CommissionerOverrideSchema.parse(strip(i)))
      .filter((o) => o.seasonId === seasonId)
  }

  async recordAudit(e: AuditEvent): Promise<void> {
    await this.store.put({ ...K.audit(e.leagueId, e.at, e.id), ...e })
  }

  async listAudit(leagueId: string, limit: number): Promise<AuditEvent[]> {
    const p = K.auditPrefix(leagueId)
    return (await this.store.query(p.PK, p.prefix, { descending: true, limit })).map((i) =>
      AuditEventSchema.parse(strip(i)),
    )
  }

  // ---- NFL data ----------------------------------------------------------
  async listWeeks(year: number): Promise<NFLWeek[]> {
    const p = K.weeksPrefix(year)
    return (await this.store.query(p.PK, p.prefix)).map((i) => NFLWeekSchema.parse(strip(i)))
  }

  async putWeek(w: NFLWeek): Promise<void> {
    await this.store.put({ ...K.week(w.seasonYear, w.week), ...w })
  }

  async listGames(year: number, week?: number): Promise<NFLGame[]> {
    const p = K.gamesPrefix(year, week)
    return (await this.store.query(p.PK, p.prefix)).map((i) => NFLGameSchema.parse(strip(i)))
  }

  async getGame(year: number, week: number, gameId: string): Promise<NFLGame | null> {
    const { PK, SK } = K.game(year, week, gameId)
    const item = await this.store.get(PK, SK)
    return item ? NFLGameSchema.parse(strip(item)) : null
  }

  /**
   * Game ids normally embed season and week (<year>-w<ww>-<away>-at-<home>);
   * ids in another format are found by scanning the hinted season year.
   */
  async findGame(gameId: string, yearHint?: number): Promise<NFLGame | null> {
    const m = gameId.match(/^(\d{4})-w(\d{2})-/)
    if (m) return this.getGame(Number(m[1]), Number(m[2]), gameId)
    if (yearHint === undefined) return null
    return (await this.listGames(yearHint)).find((g) => g.id === gameId) ?? null
  }

  /** Optimistic write keyed on resultVersion so overlapping sync runs cannot clobber each other. */
  async saveGame(game: NFLGame, expectedVersion: number | null): Promise<void> {
    const key = K.game(game.seasonYear, game.week, game.id)
    if (expectedVersion === null) await this.store.put({ ...key, ...game })
    else
      await this.store.put(
        { ...key, ...game },
        { ifEquals: { attr: 'resultVersion', value: expectedVersion } },
      )
  }

  // ---- aggregate ---------------------------------------------------------
  async loadSnapshot(league: League, season: Season): Promise<SeasonSnapshot> {
    const memberships = await this.listMemberships(league.id, season.id)
    const playerIds = memberships.map((m) => m.playerId)
    const [profiles, images, picks, games, weeks, gameOverrides, decision] = await Promise.all([
      this.listProfiles(playerIds),
      this.listImages(playerIds),
      this.listPicks(season.id),
      this.listGames(season.year),
      this.listWeeks(season.year),
      this.listGameOverrides(league.id),
      this.getDecision(season.id),
    ])
    return {
      league,
      season,
      memberships,
      profiles,
      images,
      picks,
      games,
      weeks,
      gameOverrides,
      decision,
      hiddenPicks: [],
    }
  }
}
