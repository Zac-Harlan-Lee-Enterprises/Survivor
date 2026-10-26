// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LeagueMessage } from '@/features/league-home/LeagueMessage'

afterEach(cleanup)

describe('the week 7 review from the late commissioner', () => {
  it.each([1, 8])('reads in the week %i display scope, Death in the room', (week) => {
    render(<LeagueMessage week={week} />)
    expect(screen.getByRole('heading', { name: /word from the late commissioner/i })).toBeVisible()
    expect(screen.getByText(/Last week Death asked whether we offer a group rate/)).toBeVisible()
    expect(screen.getByText(/seven of you were knocked out this week/)).toBeVisible()
  })

  it('sets the pick instruction apart from the banter', () => {
    render(<LeagueMessage week={8} />)
    const callout = screen.getByText(/DM me your week 8 pick on Teams before 7:10 PM Thursday/)
    expect(callout).toBeVisible()
    expect(callout.textContent).toMatch(/costs a life/)
  })

  it('is not shown outside its weeks', () => {
    const { container, rerender } = render(<LeagueMessage week={0} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<LeagueMessage week={9} />)
    expect(container).toBeEmptyDOMElement()
  })
})
