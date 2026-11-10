// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { engraving } from './engraving'
import { Trophy } from './Trophy'

describe('Trophy', () => {
  it('stands still with the champion’s name engraved on its plaque', () => {
    const { container } = render(<Trophy name="Allison Petty" />)
    const img = screen.getByRole('img', { name: 'The league trophy, engraved for Allison Petty' })
    expect(img.getAttribute('src')).toMatch(/trophy\/still\.webp$/)
    expect(container.querySelector('.trophy-name')?.textContent).toBe('Allison Petty')
  })

  it('leaves the plaque’s last line blank until there is a champion', () => {
    const { container } = render(<Trophy />)
    expect(screen.getByRole('img', { name: 'The league trophy' })).toBeTruthy()
    expect(container.querySelector('.trophy-name')).toBeNull()
  })
})

describe('engraving', () => {
  it('cuts a short name at the line’s height and a long one smaller, so both fit', () => {
    expect(engraving('Ann', 140, 20)).toBe(19)
    const long = engraving('Allison Petty & Joseph Tomczuk', 140, 20)
    expect(long).toBeLessThan(19)
    expect(long * 0.5 * 'Allison Petty & Joseph Tomczuk'.length).toBeLessThanOrEqual(140)
  })
})
