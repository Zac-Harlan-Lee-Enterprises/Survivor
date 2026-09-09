import { describe, expect, it } from 'vitest'
import {
  espnWeekUrl,
  liveDetailFor,
  mapEspnStatus,
  parseScoreboard,
  type EspnScoreboard,
} from './espn'
import realWeek1 from './__fixtures__/espn-2026-week1.json'

const OBSERVED = '2026-09-14T04:00:00.000Z'

describe('espnWeekUrl', () => {
  it('asks for one regular-season week', () => {
    expect(espnWeekUrl(2026, 3)).toBe(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2026&seasontype=2&week=3',
    )
  })
})

describe('mapEspnStatus', () => {
  it('maps every state we act on, defaulting to scheduled', () => {
    expect(mapEspnStatus('STATUS_FINAL')).toBe('final')
    expect(mapEspnStatus('STATUS_FINAL_OT')).toBe('final')
    expect(mapEspnStatus('STATUS_IN_PROGRESS')).toBe('in_progress')
    expect(mapEspnStatus('STATUS_HALFTIME')).toBe('in_progress')
    expect(mapEspnStatus('STATUS_POSTPONED')).toBe('postponed')
    expect(mapEspnStatus('STATUS_CANCELED')).toBe('cancelled')
    expect(mapEspnStatus('STATUS_SCHEDULED')).toBe('scheduled')
    expect(mapEspnStatus('SOMETHING_NEW')).toBe('scheduled')
  })
})

describe('parseScoreboard against a real captured payload', () => {
  const parsed = parseScoreboard(realWeek1 as EspnScoreboard, OBSERVED)

  it('reads the season and week from the payload itself', () => {
    expect(parsed.seasonYear).toBe(2026)
    expect(parsed.week.week).toBe(1)
    expect(parsed.week.source).toBe('provider')
  })

  it('parses the full 16-game slate with no byes in week 1', () => {
    expect(parsed.games).toHaveLength(16)
    expect(parsed.skipped).toBe(0)
    expect(parsed.week.byeTeamIds).toEqual([])
  })

  it('produces provider-independent ids and UTC kickoffs', () => {
    const jax = parsed.games.find((g) => g.homeTeamId === 'JAX' || g.awayTeamId === 'JAX')!
    expect(jax.id).toBe('2026-w01-CLE-at-JAX')
    expect(jax.kickoffAt).toMatch(/^2026-09-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/)
  })

  it('leaves scheduled games without scores or a winner', () => {
    for (const g of parsed.games) {
      expect(g.status).toBe('scheduled')
      expect(g.homeScore).toBeUndefined()
      expect(g.winnerTeamId).toBeUndefined()
    }
  })

  it('covers every team the league picked in week 1', () => {
    const playing = new Set(parsed.games.flatMap((g) => [g.homeTeamId, g.awayTeamId]))
    for (const teamId of ['JAX', 'BAL', 'DET', 'LAC', 'SEA']) {
      expect(playing.has(teamId), `${teamId} should play in week 1`).toBe(true)
    }
  })
})

describe('parseScoreboard result handling', () => {
  const build = (over: Partial<EspnScoreboard> = {}): EspnScoreboard => ({
    season: { year: 2026, type: 2 },
    week: { number: 5 },
    ...over,
  })
  const event = (
    home: string,
    away: string,
    status: string,
    homeScore?: string,
    awayScore?: string,
  ) => ({
    date: '2026-10-11T17:00Z',
    status: { type: { name: status } },
    competitions: [
      {
        date: '2026-10-11T17:00Z',
        status: { type: { name: status } },
        competitors: [
          { homeAway: 'home', score: homeScore, team: { abbreviation: home } },
          { homeAway: 'away', score: awayScore, team: { abbreviation: away } },
        ],
      },
    ],
  })

  it('derives the winner from the score, and null for a tie', () => {
    const { games } = parseScoreboard(
      build({
        events: [
          event('GB', 'CHI', 'STATUS_FINAL', '27', '20'),
          event('KC', 'DEN', 'STATUS_FINAL', '17', '24'),
          event('DAL', 'PHI', 'STATUS_FINAL', '20', '20'),
        ],
      }),
      OBSERVED,
    )
    expect(games.map((g) => g.winnerTeamId)).toEqual(['GB', 'DEN', null])
    expect(games[0]).toMatchObject({ homeScore: 27, awayScore: 20, resultSource: 'provider' })
  })

  it('keeps live scores for in-progress games without declaring a winner', () => {
    const { games } = parseScoreboard(
      build({ events: [event('SEA', 'LAR', 'STATUS_IN_PROGRESS', '10', '7')] }),
      OBSERVED,
    )
    expect(games[0]).toMatchObject({ status: 'in_progress', homeScore: 10, awayScore: 7 })
    expect(games[0]?.winnerTeamId).toBeUndefined()
  })

  it('skips events it cannot understand rather than guessing', () => {
    const { games, skipped } = parseScoreboard(
      build({
        events: [
          event('GB', 'CHI', 'STATUS_FINAL', '27', '20'),
          event('???', 'MIA', 'STATUS_SCHEDULED'),
          // Final with no score and no winner flag: unresolvable, not invented.
          event('BUF', 'NYJ', 'STATUS_FINAL'),
        ],
      }),
      OBSERVED,
    )
    expect(games).toHaveLength(1)
    expect(skipped).toBe(2)
  })

  it('reports byes for teams absent from the slate', () => {
    const { week } = parseScoreboard(
      build({ events: [event('GB', 'CHI', 'STATUS_SCHEDULED')] }),
      OBSERVED,
    )
    expect(week.byeTeamIds).toHaveLength(30)
    expect(week.byeTeamIds).not.toContain('GB')
  })

  it('falls back to the requested season and week when the payload omits them', () => {
    const parsed = parseScoreboard({ events: [event('GB', 'CHI', 'STATUS_SCHEDULED')] }, OBSERVED, {
      seasonYear: 2026,
      week: 9,
    })
    expect(parsed.week.week).toBe(9)
    expect(parsed.games[0]?.id).toBe('2026-w09-CHI-at-GB')
  })

  it('refuses a payload with no identifiable week', () => {
    expect(() => parseScoreboard({ events: [] }, OBSERVED)).toThrow(/season year and week/)
  })
})

/**
 * Where a game is up to, for the slate tiles. This is display detail only — it
 * never reaches NFLGame, because a clock that ticks every few seconds would
 * either bump resultVersion constantly or be shown stale between syncs.
 */
describe('live detail', () => {
  const espnStatus = (over: Record<string, unknown> = {}) => ({
    displayClock: '5:21',
    period: 3,
    type: { name: 'STATUS_IN_PROGRESS', shortDetail: '3rd 5:21' },
    ...over,
  })

  it('prefers ESPN’s own short label, which already handles OT and period ends', () => {
    expect(liveDetailFor('in_progress', espnStatus())).toBe('3rd 5:21')
    expect(
      liveDetailFor('in_progress', espnStatus({ type: { shortDetail: 'Halftime' } })),
    ).toBe('Halftime')
  })

  it('falls back to the period and clock when no label is given', () => {
    expect(liveDetailFor('in_progress', espnStatus({ type: {} }))).toBe('Q3 5:21')
    expect(liveDetailFor('in_progress', espnStatus({ type: {}, displayClock: undefined }))).toBe(
      'Q3',
    )
  })

  it('says nothing when there is nothing to say', () => {
    expect(liveDetailFor('in_progress', undefined)).toBeNull()
    expect(liveDetailFor('in_progress', { type: {} })).toBeNull()
  })

  /** A scheduled game shows its kickoff; a final one already says who won. */
  it('is empty for every status but in-progress', () => {
    for (const status of ['scheduled', 'final', 'postponed', 'cancelled'] as const) {
      expect(liveDetailFor(status, espnStatus()), status).toBeNull()
    }
  })

  it('drops a label long enough to break the tile', () => {
    const shouty = { type: { shortDetail: 'x'.repeat(80) }, period: 2, displayClock: '1:00' }
    expect(liveDetailFor('in_progress', shouty)).toBe('Q2 1:00')
  })

  it('is keyed by game id, and only for games actually under way', () => {
    const { games, liveDetail } = parseScoreboard(
      {
        season: { year: 2026, type: 2 },
        week: { number: 5 },
        events: [
          {
            date: '2026-10-11T17:00Z',
            competitions: [
              {
                date: '2026-10-11T17:00Z',
                status: espnStatus(),
                competitors: [
                  { homeAway: 'home', score: '14', team: { abbreviation: 'DET' } },
                  { homeAway: 'away', score: '10', team: { abbreviation: 'NO' } },
                ],
              },
            ],
          },
          {
            date: '2026-10-11T17:00Z',
            competitions: [
              {
                date: '2026-10-11T17:00Z',
                status: { type: { name: 'STATUS_SCHEDULED' } },
                competitors: [
                  { homeAway: 'home', score: '0', team: { abbreviation: 'KC' } },
                  { homeAway: 'away', score: '0', team: { abbreviation: 'DEN' } },
                ],
              },
            ],
          },
        ],
      },
      OBSERVED,
    )
    expect(games).toHaveLength(2)
    expect(liveDetail).toEqual({ '2026-w05-NO-at-DET': '3rd 5:21' })
  })

  it('reports nothing for the seeded week, where no game has kicked off', () => {
    expect(parseScoreboard(realWeek1 as EspnScoreboard, OBSERVED).liveDetail).toEqual({})
  })
})
