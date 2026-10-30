// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LeagueMessage } from '@/features/league-home/LeagueMessage'

afterEach(cleanup)

describe('the week 8 note from the late commissioner', () => {
  it.each([1, 8])('reads in the week %i display scope: just good luck', (week) => {
    render(<LeagueMessage week={week} />)
    expect(screen.getByRole('heading', { name: /word from the late commissioner/i })).toBeVisible()
    expect(screen.getByText('Good luck.')).toBeVisible()
  })

  it('is not shown outside its weeks', () => {
    const { container, rerender } = render(<LeagueMessage week={0} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<LeagueMessage week={9} />)
    expect(container).toBeEmptyDOMElement()
  })
})
