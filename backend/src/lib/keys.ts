/**
 * Single-table DynamoDB key design (documented in docs/data-model.md).
 *
 *   PK                    SK                              Entity
 *   LEAGUES               LEAGUE#<leagueId>               league index row
 *   SEASONS               SEASON#<seasonId>               season index row (-> leagueId)
 *   LEAGUE#<id>           META                            League
 *   LEAGUE#<id>           SEASON#<seasonId>               Season
 *   LEAGUE#<id>           MEMBER#<seasonId>#<playerId>    LeagueMembership
 *   LEAGUE#<id>           GAMEOVERRIDE#<gameId>           LeagueGameOverride
 *   LEAGUE#<id>           OVERRIDE#<isoTs>#<id>           CommissionerOverride
 *   LEAGUE#<id>           AUDIT#<isoTs>#<id>              AuditEvent
 *   SEASON#<seasonId>     PICK#<playerId>#<ww>            Pick
 *   SEASON#<seasonId>     DECISION                        SeasonDecision
 *   PLAYER#<playerId>     PROFILE                         PlayerProfile (+ email)
 *   PLAYER#<playerId>     IMAGE#<imageId>                 PlayerImage
 *   USER#<cognitoSub>     PLAYER                          { playerId } identity link
 *   NFL#<year>            WEEK#<ww>                       NFLWeek
 *   NFL#<year>            GAME#<ww>#<gameId>              NFLGame
 */
export const ww = (week: number) => String(week).padStart(2, '0')

export const K = {
  leagues: () => ({ PK: 'LEAGUES' }),
  leagueIndex: (leagueId: string) => ({ PK: 'LEAGUES', SK: `LEAGUE#${leagueId}` }),
  seasonIndex: (seasonId: string) => ({ PK: 'SEASONS', SK: `SEASON#${seasonId}` }),
  league: (leagueId: string) => ({ PK: `LEAGUE#${leagueId}`, SK: 'META' }),
  season: (leagueId: string, seasonId: string) => ({
    PK: `LEAGUE#${leagueId}`,
    SK: `SEASON#${seasonId}`,
  }),
  member: (leagueId: string, seasonId: string, playerId: string) => ({
    PK: `LEAGUE#${leagueId}`,
    SK: `MEMBER#${seasonId}#${playerId}`,
  }),
  membersPrefix: (leagueId: string, seasonId: string) => ({
    PK: `LEAGUE#${leagueId}`,
    prefix: `MEMBER#${seasonId}#`,
  }),
  gameOverride: (leagueId: string, gameId: string) => ({
    PK: `LEAGUE#${leagueId}`,
    SK: `GAMEOVERRIDE#${gameId}`,
  }),
  gameOverridesPrefix: (leagueId: string) => ({
    PK: `LEAGUE#${leagueId}`,
    prefix: 'GAMEOVERRIDE#',
  }),
  override: (leagueId: string, at: string, id: string) => ({
    PK: `LEAGUE#${leagueId}`,
    SK: `OVERRIDE#${at}#${id}`,
  }),
  overridesPrefix: (leagueId: string) => ({ PK: `LEAGUE#${leagueId}`, prefix: 'OVERRIDE#' }),
  audit: (leagueId: string, at: string, id: string) => ({
    PK: `LEAGUE#${leagueId}`,
    SK: `AUDIT#${at}#${id}`,
  }),
  auditPrefix: (leagueId: string) => ({ PK: `LEAGUE#${leagueId}`, prefix: 'AUDIT#' }),
  pick: (seasonId: string, playerId: string, week: number) => ({
    PK: `SEASON#${seasonId}`,
    SK: `PICK#${playerId}#${ww(week)}`,
  }),
  picksPrefix: (seasonId: string) => ({ PK: `SEASON#${seasonId}`, prefix: 'PICK#' }),
  decision: (seasonId: string) => ({ PK: `SEASON#${seasonId}`, SK: 'DECISION' }),
  profile: (playerId: string) => ({ PK: `PLAYER#${playerId}`, SK: 'PROFILE' }),
  image: (playerId: string, imageId: string) => ({
    PK: `PLAYER#${playerId}`,
    SK: `IMAGE#${imageId}`,
  }),
  imagesPrefix: (playerId: string) => ({ PK: `PLAYER#${playerId}`, prefix: 'IMAGE#' }),
  user: (sub: string) => ({ PK: `USER#${sub}`, SK: 'PLAYER' }),
  week: (year: number, week: number) => ({ PK: `NFL#${year}`, SK: `WEEK#${ww(week)}` }),
  weeksPrefix: (year: number) => ({ PK: `NFL#${year}`, prefix: 'WEEK#' }),
  game: (year: number, week: number, gameId: string) => ({
    PK: `NFL#${year}`,
    SK: `GAME#${ww(week)}#${gameId}`,
  }),
  gamesPrefix: (year: number, week?: number) => ({
    PK: `NFL#${year}`,
    prefix: week === undefined ? 'GAME#' : `GAME#${ww(week)}#`,
  }),
}
