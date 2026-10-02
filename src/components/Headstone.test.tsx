// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { LeagueContext, ServicesContext, type LeagueContextValue } from '@/app/hooks'
import { evaluateSeason, findStanding, type PlayerStanding } from '@/domain'
import { kickoffFor, scenario } from '@/domain/testing/scenario'
import type { Services } from '@/data'
import { Headstone } from './Headstone'
import { PlayerCard } from './PlayerCard'

function wrap(children: ReactNode) {
  const services = {
    images: {
      defaultAvatarUrl: () => '/Survivor/headshots/default.svg',
      variantUrl: () => '/Survivor/headshots/default.svg',
    },
  } as unknown as Services
  const league = { imageOf: () => null } as unknown as LeagueContextValue
  return render(
    <MemoryRouter>
      <ServicesContext.Provider value={services}>
        <LeagueContext.Provider value={league}>{children}</LeagueContext.Provider>
      </ServicesContext.Provider>
    </MemoryRouter>,
  )
}

/** Ann goes out in week 3 on Seattle, after the Chargers and the Bucs; Bob is alive. */
function standings(): { ann: PlayerStanding; bob: PlayerStanding } {
  const snap = scenario()
    .players('ann', 'bob')
    .game(1, 'LAC', 'ARI', { final: 'ARI' })
    .game(2, 'TB', 'CLE', { final: 'CLE' })
    .game(3, 'WAS', 'SEA', { final: 'WAS' })
    .pick('ann', 1, 'LAC')
    .pick('ann', 2, 'TB')
    .pick('ann', 3, 'SEA')
    .pick('bob', 1, 'ARI')
    .pick('bob', 2, 'CLE')
    .pick('bob', 3, 'WAS')
    .build()
  const ev = evaluateSeason(snap, { now: kickoffFor(4, 48) })
  return { ann: findStanding(ev, 'ann')!, bob: findStanding(ev, 'bob')! }
}

const profile = (playerId: string, displayName: string) => ({
  playerId,
  displayName,
  imageId: null,
})

describe('Headstone', () => {
  it('announces who lies here, when, and of what', () => {
    wrap(<Headstone name="Ann Example" playerId="ann" standing={standings().ann} size="hero" />)
    expect(
      screen.getByRole('img', {
        name: 'Headstone of Ann Example, eliminated in week 3. Died of the Seahawks, week 3. Complications: the Chargers (wk 1), the Buccaneers (wk 2).',
      }),
    ).toBeInTheDocument()
  })

  it('engraves the whole story on a hero stone', () => {
    wrap(<Headstone name="Ann Example" playerId="ann" standing={standings().ann} size="hero" />)
    const stone = screen.getByRole('img')
    expect(within(stone).getByText('RIP')).toBeInTheDocument()
    expect(within(stone).getByText('Ann Example')).toBeInTheDocument()
    expect(within(stone).getByText('Weeks 1–3')).toBeInTheDocument()
    expect(within(stone).getByText(/Died of the Seahawks/)).toBeInTheDocument()
  })

  it('carves only RIP into a thumbnail, keeping the full story for screen readers', () => {
    wrap(<Headstone name="Ann Example" playerId="ann" standing={standings().ann} size="md" />)
    const stone = screen.getByRole('img', { name: /Headstone of Ann Example/ })
    expect(within(stone).getByText('RIP')).toBeInTheDocument()
    expect(within(stone).queryByText(/Died of/)).toBeNull()
    expect(within(stone).queryByText('Ann Example')).toBeNull()
  })

  it('without a funeral, shows the stone and no face', () => {
    wrap(<Headstone name="Ann Example" playerId="ann" standing={standings().ann} />)
    expect(screen.getAllByRole('img')).toHaveLength(1)
    expect(document.querySelector('.animate-crumble')).toBeNull()
  })

  it('at a funeral, the face is there to crumble — hidden from assistive tech, which hears only the stone', () => {
    wrap(<Headstone name="Ann Example" playerId="ann" standing={standings().ann} funeral />)
    const face = document.querySelector('.animate-crumble')
    expect(face).not.toBeNull()
    expect(face).toHaveAttribute('aria-hidden', 'true')
    expect(face?.querySelector('img')).not.toBeNull()
    expect(screen.getAllByRole('img')).toHaveLength(1)
    expect(screen.getByRole('img').className).toMatch(/animate-stone-rise/)
  })
})

describe('PlayerCard', () => {
  it('turns an eliminated player into a headstone that still links to their profile', () => {
    wrap(
      <PlayerCard
        standing={standings().ann}
        profile={profile('ann', 'Ann Example')}
        pickVisible
        compact
      />,
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/players/ann')
    expect(within(link).getByRole('img', { name: /Headstone of Ann Example/ })).toBeInTheDocument()
    expect(within(link).queryByRole('img', { name: /Headshot of/ })).toBeNull()
  })

  it('keeps the living as faces', () => {
    wrap(<PlayerCard standing={standings().bob} profile={profile('bob', 'Bob Example')} pickVisible />)
    expect(screen.getByRole('img', { name: 'Headshot of Bob Example' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Headstone/ })).toBeNull()
  })

  it('passes the funeral through to the stone', () => {
    wrap(
      <PlayerCard
        standing={standings().ann}
        profile={profile('ann', 'Ann Example')}
        pickVisible
        compact
        funeral
      />,
    )
    expect(document.querySelector('.animate-crumble')).not.toBeNull()
  })
})
