import { describe, expect, it } from 'vitest'
import { parseCsv, toCsv } from './csv'
import { importGridCsv, materializePicks, parseCell, renderReportMarkdown } from './importGrid'
import { scenario } from '../testing/scenario'

const SHEET = `Player,Week 1,Week 2,Week 3
Ann,Packers,Chiefs*,Cowboys
Bob,GB,Denver,Philly
Cat,Los Angeles,Bears,
Dan,Packers,,Packers
`

describe('parseCsv', () => {
  it('handles quotes, escaped quotes and CRLF', () => {
    const rows = parseCsv('a,"b, c","say ""hi"""\r\n1,2,3\r\n')
    expect(rows).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['1', '2', '3'],
    ])
    expect(toCsv(rows)).toBe('a,"b, c","say ""hi"""\n1,2,3\n')
  })
})

describe('parseCell', () => {
  it('strips loss markers', () => {
    expect(parseCell('Chiefs*')).toEqual({ text: 'Chiefs', markedLoss: true })
    expect(parseCell('Chiefs (L)')).toEqual({ text: 'Chiefs', markedLoss: true })
    expect(parseCell('Chiefs L')).toEqual({ text: 'Chiefs', markedLoss: true })
    expect(parseCell(' Chiefs ')).toEqual({ text: 'Chiefs', markedLoss: false })
  })
})

describe('importGridCsv', () => {
  it('parses the grid and resolves teams by nickname, city and abbreviation', () => {
    const result = importGridCsv(SHEET, { source: 'test-sheet', now: '2026-10-01T00:00:00Z' })
    expect(result.weeks).toEqual([1, 2, 3])
    expect(result.players.map((p) => p.name)).toEqual(['Ann', 'Bob', 'Cat', 'Dan'])
    const ann = result.players[0]!
    expect(ann.cells.map((c) => c.teamId)).toEqual(['GB', 'KC', 'DAL'])
    expect(ann.cells[1]?.markedLoss).toBe(true)
    const bob = result.players[1]!
    expect(bob.cells.map((c) => c.teamId)).toEqual(['GB', 'DEN', 'PHI'])
  })

  it('flags ambiguous, missing and reused picks without guessing', () => {
    const { report } = importGridCsv(SHEET, { now: '2026-10-01T00:00:00Z' })
    const codes = report.issues.map((i) => `${i.code}:${i.player}:${i.week}`)
    expect(codes).toContain('AMBIGUOUS_TEAM:Cat:1')
    expect(codes).toContain('MISSING_PICK:Dan:2')
    expect(codes).toContain('REUSED_TEAM:Dan:3')
    expect(codes).toContain('RECORDED_LOSS:Ann:2')
    // Cat's empty week 3 is her latest week, so it's "not yet picked", not a miss.
    expect(codes).not.toContain('MISSING_PICK:Cat:3')
    const cat = report.issues.find((i) => i.code === 'AMBIGUOUS_TEAM')!
    expect(cat.message).toMatch(/LAC or LAR/)
    expect(report.counts.error).toBe(2)
  })

  it('flags unknown teams, duplicate players and empty names', () => {
    const { report } = importGridCsv('Player,Week 1\nAnn,Wolves\nAnn,GB\n,KC\n')
    expect(report.issues.map((i) => i.code).sort()).toEqual([
      'DUPLICATE_PLAYER',
      'EMPTY_PLAYER_NAME',
      'UNKNOWN_TEAM',
    ])
  })

  it('cross-checks byes and recorded losses against known results', () => {
    const snap = scenario()
      .players('ann')
      .game(1, 'GB', 'CHI', { final: 'GB' })
      .game(2, 'KC', 'DEN', { final: 'DEN' })
      .build()
    const csv = 'Player,Week 1,Week 2\nAnn,Packers*,Chiefs\nBob,Dolphins,Broncos\n'
    const { report } = importGridCsv(csv, { games: snap.games })
    const codes = report.issues.map((i) => `${i.code}:${i.player}:${i.week}`)
    // Ann marked GB as a loss but GB won; she did not mark KC but KC lost.
    expect(codes).toContain('LOSS_MARKER_CONTRADICTS_RESULT:Ann:1')
    expect(codes).toContain('LOSS_MARKER_CONTRADICTS_RESULT:Ann:2')
    expect(codes).toContain('TEAM_ON_BYE:Bob:1')
  })

  it('detects picks made after a third miss', () => {
    const csv = 'Player,Week 1,Week 2,Week 3,Week 4\nAnn,GB*,KC*,DAL*,PHI\n'
    const { report } = importGridCsv(csv, { lives: 3 })
    expect(report.issues.some((i) => i.code === 'PICK_AFTER_ELIMINATION' && i.week === 4)).toBe(
      true,
    )
  })

  it('materializes picks for known members and reports unknown names', () => {
    const snap = scenario()
      .players('ann')
      .game(1, 'GB', 'CHI', { final: 'GB' })
      .game(2, 'KC', 'DEN')
      .build()
    const result = importGridCsv('Player,Week 1,Week 2\nAnn,GB,KC\nZed,GB,\n')
    const { picks, issues } = materializePicks(result, {
      leagueId: 'league-1',
      seasonId: 'season-1',
      games: snap.games,
      playerIdByName: (n) => (n === 'Ann' ? 'ann' : undefined),
      now: '2026-10-01T00:00:00Z',
    })
    expect(picks.map((p) => `${p.playerId}:${p.week}:${p.teamId}:${p.gameId}`)).toEqual([
      'ann:1:GB:g-1-CHI-GB',
      'ann:2:KC:g-2-DEN-KC',
    ])
    expect(picks[0]?.source).toBe('import')
    expect(issues.map((i) => i.code)).toEqual(['UNKNOWN_PLAYER'])
  })

  it('renders a markdown report', () => {
    const { report } = importGridCsv(SHEET, { source: 'sheet.csv', now: '2026-10-01T00:00:00Z' })
    const md = renderReportMarkdown(report)
    expect(md).toContain('# Import report — sheet.csv')
    expect(md).toContain('| error | AMBIGUOUS_TEAM | Cat | 1 |')
  })

  it('reports a missing header', () => {
    const { report } = importGridCsv('')
    expect(report.issues[0]?.code).toBe('HEADER_MISSING')
  })
})
