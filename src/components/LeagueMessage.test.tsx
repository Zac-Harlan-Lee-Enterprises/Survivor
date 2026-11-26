// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LeagueMessage } from '@/features/league-home/LeagueMessage'

afterEach(cleanup)

describe('the week 11 review from the late commissioner', () => {
  it.each([1, 12])('reads in the week %i display scope, Death in the room', (week) => {
    render(<LeagueMessage week={week} />)
    expect(screen.getByRole('heading', { name: /word from the late commissioner/i })).toBeVisible()
    expect(screen.getByText(/^Five picks, five winners, again\./)).toBeVisible()
    expect(screen.getByText(/gain more by fainting/)).toBeVisible()
  })

  it('sets the lock and the week 13 pick instruction apart from the banter', () => {
    render(<LeagueMessage week={12} />)
    const callout = screen.getByText(
      /Week 13: DM me your pick on Teams before 7:10 PM Thursday, December 3/,
    )
    expect(callout.textContent).toMatch(
      /^All five week 12 picks are in\. They lock at 6:55 PM Wednesday, November 25/,
    )
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
