// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LeagueMessage } from '@/features/league-home/LeagueMessage'

const approved =
  'Being commissioner was easier when I was alive. Now I spend my weekends answering messages from the living while Death leans over my shoulder asking, “Anything yet?” The man has absolutely no patience for a pending result. He’s already sharpened his pencil, cleared space in the cemetery, and asked whether we offer a group rate. I told him these are my friends and he should show some respect, so he took his feet off my desk. That’s apparently the extent of the accommodation. Good luck this week, everyone. I’m rooting for you. The tall gentleman behind me has declined to comment.'

afterEach(cleanup)

describe('the approved message from beyond', () => {
  it.each([1, 7])(
    'shows the exact approved paragraph in the existing week %i display scope',
    (week) => {
      const { container } = render(<LeagueMessage week={week} />)
      expect(screen.getByText(approved)).toBeVisible()
      expect(container.querySelectorAll('p')).toHaveLength(1)
      expect(container.textContent).not.toMatch(/Teams|deadline|7:10/)
    },
  )

  it('expires outside the intended weeks', () => {
    const { container, rerender } = render(<LeagueMessage week={0} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<LeagueMessage week={8} />)
    expect(container).toBeEmptyDOMElement()
  })
})
