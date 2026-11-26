// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LeagueMessage } from '@/features/league-home/LeagueMessage'

afterEach(cleanup)

describe('the week 12 picks note from the late commissioner', () => {
  it.each([1, 12])('reads in the week %i display scope, Death in the room', (week) => {
    render(<LeagueMessage week={week} />)
    expect(screen.getByRole('heading', { name: /word from the late commissioner/i })).toBeVisible()
    expect(screen.getByText(/^All five week 12 picks are locked\./)).toBeVisible()
    expect(screen.getByText(/He has wound his watch/)).toBeVisible()
  })

  it('sets the lock and the week 13 pick instruction apart from the banter', () => {
    render(<LeagueMessage week={12} />)
    const callout = screen.getByText(
      /Week 13: DM me your pick on Teams before 7:10 PM Thursday, December 3/,
    )
    expect(callout.textContent).toMatch(/^Week 12 picks are locked\./)
    expect(callout).toBeVisible()
    expect(callout.textContent).toMatch(/costs a life/)
  })

  it('is not shown outside its weeks', () => {
    const { container, rerender } = render(<LeagueMessage week={0} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<LeagueMessage week={13} />)
    expect(container).toBeEmptyDOMElement()
  })
})
