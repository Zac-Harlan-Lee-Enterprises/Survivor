// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { LeagueContext, ServicesContext, type LeagueContextValue } from '@/app/hooks'
import type { PlayerImage } from '@/domain'
import type { Services } from '@/data'
import { Headshot } from './Headshot'
import { LivesMeter } from './LivesMeter'

const image: PlayerImage = {
  id: 'img-ann',
  playerId: 'ann',
  contentType: 'image/webp',
  sizeBytes: 100,
  variants: { thumb: 'headshots/ann.svg', medium: 'headshots/ann-medium.svg' },
  createdAt: '2026-08-01T00:00:00.000Z',
}

function wrap(children: ReactNode, images: PlayerImage[] = [image]) {
  const services = {
    images: {
      defaultAvatarUrl: () => '/Survivor/headshots/default.svg',
      variantUrl: (img: PlayerImage | null | undefined, variant: 'thumb' | 'medium') =>
        img ? `/Survivor/${img.variants[variant]}` : '/Survivor/headshots/default.svg',
    },
  } as unknown as Services
  const league = {
    imageOf: (id: string) => images.find((i) => i.playerId === id) ?? null,
  } as unknown as LeagueContextValue
  return render(
    <ServicesContext.Provider value={services}>
      <LeagueContext.Provider value={league}>{children}</LeagueContext.Provider>
    </ServicesContext.Provider>,
  )
}

describe('Headshot', () => {
  it('renders the stored variant with meaningful alt text', () => {
    wrap(<Headshot name="Ann Example" playerId="ann" size="lg" status="alive" />)
    const img = screen.getByRole('img', { name: 'Headshot of Ann Example' })
    expect(img).toHaveAttribute('src', '/Survivor/headshots/ann-medium.svg')
  })

  it('uses the thumb variant for small sizes', () => {
    wrap(<Headshot name="Ann Example" playerId="ann" size="xs" />)
    expect(screen.getByRole('img')).toHaveAttribute('src', '/Survivor/headshots/ann.svg')
  })

  it('falls back to the default avatar when the player has no image', () => {
    wrap(<Headshot name="No Photo" playerId="nobody" />)
    expect(screen.getByRole('img', { name: 'Headshot of No Photo' })).toHaveAttribute(
      'src',
      '/Survivor/headshots/default.svg',
    )
  })

  it('falls back to the default avatar when the image fails to load', () => {
    wrap(<Headshot name="Ann Example" playerId="ann" />)
    const img = screen.getByRole('img')
    fireEvent.error(img)
    expect(img).toHaveAttribute('src', '/Survivor/headshots/default.svg')
  })
})

describe('LivesMeter', () => {
  it('announces lives remaining for assistive tech', () => {
    render(<LivesMeter total={3} remaining={1} />)
    expect(screen.getByRole('img', { name: '1 of 3 lives remaining' })).toBeInTheDocument()
  })
})
