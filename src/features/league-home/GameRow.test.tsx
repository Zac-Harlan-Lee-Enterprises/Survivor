// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { LeagueContext, type LeagueContextValue } from '@/app/hooks'
import type { NFLGame } from '@/domain'
import { GameRow } from './LeagueHome'

/**
 * The slate tile. The pulse is asserted here rather than end to end because it
 * lasts a second: a browser test would have to race it. `changedScores` covers
 * the comparison itself; this covers the wiring to the DOM.
 */
const league = {
  league: { settings: { displayTimeZone: 'America/Chicago' } },
} as unknown as LeagueContextValue

const wrap = (children: ReactNode) =>
  render(<LeagueContext.Provider value={league}>{children}</LeagueContext.Provider>)

const game = (over: Partial<NFLGame> = {}): NFLGame => ({
  id: '2026-w01-CLE-at-JAX',
  seasonYear: 2026,
  week: 1,
  homeTeamId: 'JAX',
  awayTeamId: 'CLE',
  kickoffAt: '2026-09-13T17:00:00.000Z',
  status: 'scheduled',
  resultVersion: 0,
  updatedAt: '2026-09-13T17:00:00.000Z',
  ...over,
})

const bumped = (container: HTMLElement) => container.querySelectorAll('.animate-score-bump')

describe('GameRow', () => {
  it('shows the kickoff, and no score, before a game starts', () => {
    const { container } = wrap(<GameRow game={game()} />)
    expect(screen.getByText(/CLE at JAX/i)).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/\d+\s*$/)
  })

  /** An in-progress game used to render no score and look as if it had not started. */
  it('shows the score and where the game is up to once it is under way', () => {
    wrap(
      <GameRow
        game={game({ status: 'in_progress', homeScore: 14, awayScore: 10 })}
        detail="3rd 5:21"
      />,
    )
    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('3rd 5:21')).toBeInTheDocument()
    expect(screen.queryByText(/CLE at JAX/i)).not.toBeInTheDocument()
  })

  it('says a game is in progress even when the feed gives no clock', () => {
    wrap(<GameRow game={game({ status: 'in_progress', homeScore: 0, awayScore: 0 })} />)
    expect(screen.getByText(/in progress/i)).toBeInTheDocument()
  })

  it('still names the winner once the game is final', () => {
    wrap(
      <GameRow
        game={game({ status: 'final', homeScore: 27, awayScore: 20, winnerTeamId: 'JAX' })}
      />,
    )
    expect(screen.getByText(/Final · Jaguars win/)).toBeInTheDocument()
  })

  it('does not pulse on first render, whatever the score', () => {
    const { container } = wrap(
      <GameRow game={game({ status: 'in_progress', homeScore: 14, awayScore: 10 })} />,
    )
    expect(bumped(container)).toHaveLength(0)
  })

  it('pulses only the side that scored', () => {
    const live = game({ status: 'in_progress', homeScore: 14, awayScore: 10 })
    const { container, rerender } = wrap(<GameRow game={live} />)
    rerender(
      <LeagueContext.Provider value={league}>
        <GameRow game={{ ...live, homeScore: 21 }} />
      </LeagueContext.Provider>,
    )
    const flashing = bumped(container)
    expect(flashing).toHaveLength(1)
    expect(flashing[0]?.textContent).toBe('21')
  })

  it('pulses both sides when both moved between readings', () => {
    const live = game({ status: 'in_progress', homeScore: 14, awayScore: 10 })
    const { container, rerender } = wrap(<GameRow game={live} />)
    rerender(
      <LeagueContext.Provider value={league}>
        <GameRow game={{ ...live, homeScore: 21, awayScore: 17 }} />
      </LeagueContext.Provider>,
    )
    expect(bumped(container)).toHaveLength(2)
  })

  it('does not pulse when a re-render brings the same score', () => {
    const live = game({ status: 'in_progress', homeScore: 14, awayScore: 10 })
    const { container, rerender } = wrap(<GameRow game={live} />)
    rerender(
      <LeagueContext.Provider value={league}>
        <GameRow game={{ ...live, updatedAt: '2026-09-13T18:00:00.000Z' }} />
      </LeagueContext.Provider>,
    )
    expect(bumped(container)).toHaveLength(0)
  })
})
