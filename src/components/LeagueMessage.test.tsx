// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LeagueMessage } from '@/features/league-home/LeagueMessage'

afterEach(cleanup)

describe('the week 8 review from the late commissioner', () => {
  it.each([1, 9])('reads in the week %i display scope, Death in the room', (week) => {
    render(<LeagueMessage week={week} />)
    expect(screen.getByRole('heading', { name: /word from the late commissioner/i })).toBeVisible()
    expect(screen.getByText(/^Death went nought for five\./)).toBeVisible()
    expect(screen.getByText(/He says he is an optimist/)).toBeVisible()
  })

  it('sets the week 9 pick instruction apart from the banter', () => {
    render(<LeagueMessage week={9} />)
    const callout = screen.getByText(/DM me your week 9 pick on Teams before 7:10 PM Thursday/)
    expect(callout).toBeVisible()
    expect(callout.textContent).toMatch(/costs a life/)
  })

  it('is not shown outside its weeks', () => {
    const { container, rerender } = render(<LeagueMessage week={0} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<LeagueMessage week={10} />)
    expect(container).toBeEmptyDOMElement()
  })
})
