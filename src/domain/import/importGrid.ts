import type { NFLGame, Pick } from '../models'
import { lookupTeam } from '../teams'
import { parseCsv } from './csv'

/**
 * Imports the commissioner's spreadsheet: players as rows, weeks as columns,
 * a team in each cell, losing picks marked (the sheet uses red fill; CSV has
 * no colour, so a trailing "*", "!", "(L)" or " L" marks a loss).
 *
 * Nothing unreadable is guessed. Every uncertainty becomes a report entry the
 * commissioner resolves by hand before the picks are committed.
 */

export type ImportSeverity = 'error' | 'warning' | 'info'

export type ImportIssueCode =
  | 'SCREENSHOT_UNAVAILABLE'
  | 'HEADER_MISSING'
  | 'WEEK_COLUMN_UNRECOGNISED'
  | 'EMPTY_PLAYER_NAME'
  | 'DUPLICATE_PLAYER'
  | 'UNKNOWN_TEAM'
  | 'AMBIGUOUS_TEAM'
  | 'REUSED_TEAM'
  | 'MISSING_PICK'
  | 'TEAM_ON_BYE'
  | 'PICK_AFTER_ELIMINATION'
  | 'LOSS_MARKER_CONTRADICTS_RESULT'
  | 'RECORDED_LOSS'
  | 'UNKNOWN_PLAYER'

export interface ImportIssue {
  severity: ImportSeverity
  code: ImportIssueCode
  player: string | null
  week: number | null
  raw: string | null
  message: string
}

export interface ImportedCell {
  week: number
  raw: string
  teamId: string | null
  /** The sheet marked this cell as a loss (red). */
  markedLoss: boolean
  candidates?: string[]
}

export interface ImportedPlayer {
  name: string
  row: number
  cells: ImportedCell[]
}

export interface ImportReport {
  /** Set from options.now; null when the caller did not supply a clock. */
  generatedAt: string | null
  source: string
  players: number
  picksParsed: number
  issues: ImportIssue[]
  counts: Record<ImportSeverity, number>
}

export interface ImportResult {
  players: ImportedPlayer[]
  weeks: number[]
  report: ImportReport
}

export interface ImportOptions {
  source?: string
  /** Games for the target season; enables bye and result cross-checks. */
  games?: NFLGame[]
  /** Lives per player; enables "pick after elimination" detection. */
  lives?: number
  now?: Date | string
}

const LOSS_MARKERS = [/\s*\(l\)\s*$/i, /\s*\*+$/, /\s*!+$/, /\s+L$/, /\s+loss$/i, /\s+lost$/i]

export function parseCell(raw: string): { text: string; markedLoss: boolean } {
  let text = raw.trim()
  let markedLoss = false
  for (const re of LOSS_MARKERS) {
    if (re.test(text)) {
      markedLoss = true
      text = text.replace(re, '').trim()
    }
  }
  return { text, markedLoss }
}

function parseWeekHeader(header: string): number | null {
  const m = header.trim().match(/^(?:wk|week|w)?\s*\.?\s*(\d{1,2})$/i)
  if (!m) return null
  const n = Number(m[1])
  return n >= 1 && n <= 22 ? n : null
}

export function importGridCsv(csvText: string, options: ImportOptions = {}): ImportResult {
  return importGridRows(parseCsv(csvText), options)
}

export function importGridRows(rows: string[][], options: ImportOptions = {}): ImportResult {
  const issues: ImportIssue[] = []
  const issue = (
    severity: ImportSeverity,
    code: ImportIssueCode,
    message: string,
    ctx: Partial<ImportIssue> = {},
  ) =>
    issues.push({
      severity,
      code,
      message,
      player: ctx.player ?? null,
      week: ctx.week ?? null,
      raw: ctx.raw ?? null,
    })

  const header = rows[0]
  if (!header || header.length < 2) {
    issue('error', 'HEADER_MISSING', 'First row must be a header: Player, Week 1, Week 2, …')
    return finish([], [], issues, options, 0)
  }

  const weekByColumn = new Map<number, number>()
  header.forEach((h, col) => {
    if (col === 0) return
    const week = parseWeekHeader(h)
    if (week === null) {
      if (h.trim() !== '')
        issue('warning', 'WEEK_COLUMN_UNRECOGNISED', `Column "${h}" ignored (expected "Week N").`, {
          raw: h,
        })
      return
    }
    weekByColumn.set(col, week)
  })
  const weeks = [...weekByColumn.values()].sort((a, b) => a - b)

  const players: ImportedPlayer[] = []
  const seen = new Set<string>()
  rows.slice(1).forEach((row, i) => {
    const name = (row[0] ?? '').trim()
    if (!name) {
      issue('error', 'EMPTY_PLAYER_NAME', `Row ${i + 2} has no player name.`, {
        raw: row.join(','),
      })
      return
    }
    const key = name.toLowerCase()
    if (seen.has(key)) {
      issue('error', 'DUPLICATE_PLAYER', `Player "${name}" appears more than once.`, {
        player: name,
      })
      return
    }
    seen.add(key)

    const cells: ImportedCell[] = []
    for (const [col, week] of weekByColumn) {
      const raw = (row[col] ?? '').trim()
      const { text, markedLoss } = parseCell(raw)
      if (text === '' || /^(-|—|none|n\/a|bye)$/i.test(text)) {
        cells.push({ week, raw, teamId: null, markedLoss })
        continue
      }
      const lookup = lookupTeam(text)
      if (lookup.kind === 'match') {
        cells.push({ week, raw, teamId: lookup.teamId, markedLoss })
      } else if (lookup.kind === 'ambiguous') {
        cells.push({ week, raw, teamId: null, markedLoss, candidates: lookup.candidates })
        issue(
          'error',
          'AMBIGUOUS_TEAM',
          `"${text}" could be ${lookup.candidates.join(' or ')} — choose one.`,
          { player: name, week, raw },
        )
      } else {
        cells.push({ week, raw, teamId: null, markedLoss })
        issue('error', 'UNKNOWN_TEAM', `"${text}" is not a recognisable NFL team.`, {
          player: name,
          week,
          raw,
        })
      }
    }
    players.push({ name, row: i + 2, cells })
  })

  // Rule checks per player.
  const gamesByWeek = new Map<number, NFLGame[]>()
  for (const g of options.games ?? [])
    gamesByWeek.set(g.week, [...(gamesByWeek.get(g.week) ?? []), g])
  const lives = options.lives ?? 3

  for (const p of players) {
    const used = new Map<string, number>()
    let strikes = 0
    let eliminatedWeek: number | null = null
    let lastPickedWeek = 0
    for (const c of p.cells) if (c.teamId) lastPickedWeek = Math.max(lastPickedWeek, c.week)

    for (const c of p.cells) {
      if (eliminatedWeek !== null && c.teamId) {
        issue(
          'warning',
          'PICK_AFTER_ELIMINATION',
          `${p.name} picked ${c.teamId} in week ${c.week} after being eliminated in week ${eliminatedWeek}.`,
          { player: p.name, week: c.week, raw: c.raw },
        )
      }
      if (!c.teamId) {
        if (eliminatedWeek === null && c.week < lastPickedWeek) {
          issue(
            'warning',
            'MISSING_PICK',
            `${p.name} has no pick for week ${c.week}. Missing picks count as a miss after the deadline.`,
            { player: p.name, week: c.week },
          )
          strikes += 1
          if (strikes >= lives && eliminatedWeek === null) eliminatedWeek = c.week
        }
        continue
      }
      const priorWeek = used.get(c.teamId)
      if (priorWeek !== undefined) {
        issue(
          'error',
          'REUSED_TEAM',
          `${p.name} used ${c.teamId} in week ${priorWeek} and again in week ${c.week}. A team can only be used once per season.`,
          { player: p.name, week: c.week, raw: c.raw },
        )
      } else {
        used.set(c.teamId, c.week)
      }

      const weekGames = gamesByWeek.get(c.week)
      let game: NFLGame | undefined
      if (weekGames) {
        game = weekGames.find((g) => g.homeTeamId === c.teamId || g.awayTeamId === c.teamId)
        if (!game) {
          issue('error', 'TEAM_ON_BYE', `${c.teamId} did not play in week ${c.week} (bye).`, {
            player: p.name,
            week: c.week,
            raw: c.raw,
          })
        }
      }

      if (game && game.status === 'final') {
        const lost = game.winnerTeamId !== c.teamId
        if (lost !== c.markedLoss) {
          issue(
            'warning',
            'LOSS_MARKER_CONTRADICTS_RESULT',
            `${p.name}, week ${c.week}: sheet marks ${c.markedLoss ? 'a loss' : 'a win'} but the game result says ${lost ? 'loss/tie' : 'win'}.`,
            { player: p.name, week: c.week, raw: c.raw },
          )
        }
        if (lost) strikes += 1
      } else if (c.markedLoss) {
        issue(
          'info',
          'RECORDED_LOSS',
          `${p.name}, week ${c.week}: sheet records a loss on ${c.teamId} (no result available to verify).`,
          { player: p.name, week: c.week, raw: c.raw },
        )
        strikes += 1
      }
      if (strikes >= lives && eliminatedWeek === null) eliminatedWeek = c.week
    }
  }

  const picksParsed = players.reduce((n, p) => n + p.cells.filter((c) => c.teamId).length, 0)
  return finish(players, weeks, issues, options, picksParsed)
}

function finish(
  players: ImportedPlayer[],
  weeks: number[],
  issues: ImportIssue[],
  options: ImportOptions,
  picksParsed: number,
): ImportResult {
  const counts: Record<ImportSeverity, number> = { error: 0, warning: 0, info: 0 }
  for (const i of issues) counts[i.severity] += 1
  return {
    players,
    weeks,
    report: {
      generatedAt: options.now === undefined ? null : new Date(options.now).toISOString(),
      source: options.source ?? 'csv',
      players: players.length,
      picksParsed,
      issues,
      counts,
    },
  }
}

export interface MaterializeOptions {
  leagueId: string
  seasonId: string
  games: NFLGame[]
  /** Maps imported names to player ids; unmatched names are reported. */
  playerIdByName: (name: string) => string | undefined
  now: Date | string
}

/** Turns an import result into Pick records (source: 'import'). */
export function materializePicks(
  result: ImportResult,
  opts: MaterializeOptions,
): { picks: Pick[]; issues: ImportIssue[] } {
  const picks: Pick[] = []
  const issues: ImportIssue[] = []
  const at = new Date(opts.now).toISOString()
  for (const p of result.players) {
    const playerId = opts.playerIdByName(p.name)
    if (!playerId) {
      issues.push({
        severity: 'error',
        code: 'UNKNOWN_PLAYER',
        player: p.name,
        week: null,
        raw: null,
        message: `No league member matches "${p.name}". Add the player first or rename the row.`,
      })
      continue
    }
    for (const c of p.cells) {
      if (!c.teamId) continue
      const game = opts.games.find(
        (g) => g.week === c.week && (g.homeTeamId === c.teamId || g.awayTeamId === c.teamId),
      )
      if (!game) continue
      picks.push({
        id: `import-${playerId}-${c.week}`,
        leagueId: opts.leagueId,
        seasonId: opts.seasonId,
        playerId,
        week: c.week,
        teamId: c.teamId,
        gameId: game.id,
        submittedAt: at,
        updatedAt: at,
        version: 1,
        source: 'import',
      })
    }
  }
  return { picks, issues }
}

export function renderReportMarkdown(report: ImportReport): string {
  const lines: string[] = []
  lines.push(`# Import report — ${report.source}`)
  lines.push('')
  if (report.generatedAt) lines.push(`Generated: ${report.generatedAt}`)
  lines.push(`Players: ${report.players} · Picks parsed: ${report.picksParsed}`)
  lines.push(
    `Errors: ${report.counts.error} · Warnings: ${report.counts.warning} · Info: ${report.counts.info}`,
  )
  lines.push('')
  if (report.issues.length === 0) {
    lines.push('No issues. Every cell resolved to a valid team and no rule was violated.')
    return lines.join('\n') + '\n'
  }
  lines.push('| Severity | Code | Player | Week | Cell | Message |')
  lines.push('|---|---|---|---|---|---|')
  for (const i of report.issues) {
    const esc = (v: string | number | null) => (v === null ? '' : String(v).replace(/\|/g, '\\|'))
    lines.push(
      `| ${i.severity} | ${i.code} | ${esc(i.player)} | ${esc(i.week)} | ${esc(i.raw)} | ${esc(i.message)} |`,
    )
  }
  return lines.join('\n') + '\n'
}
