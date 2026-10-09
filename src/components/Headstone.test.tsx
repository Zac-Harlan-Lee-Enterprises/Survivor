// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { LeagueContext, ServicesContext, type LeagueContextValue } from '@/app/hooks'
import { evaluateSeason, findStanding, type PlayerStanding } from '@/domain'
import { kickoffFor, scenario } from '@/domain/testing/scenario'
import type { Services } from '@/data'
import { FUNERAL_MS } from './Funeral'
import { Headstone } from './Headstone'
import { graveVariant } from './graveVariant'
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

  it('without a funeral, shows the stone and no scene', () => {
    wrap(<Headstone name="Ann Example" playerId="ann" standing={standings().ann} />)
    expect(screen.getAllByRole('img')).toHaveLength(1)
    expect(document.querySelector('.funeral')).toBeNull()
  })

  it('without IntersectionObserver, a funeral simply plays', () => {
    wrap(<Headstone name="Ann Example" playerId="ann" standing={standings().ann} funeral />)
    expect(document.querySelector('[data-funeral]')).toHaveAttribute('data-funeral', 'playing')
  })

  it('at a funeral, the whole scene is hidden from assistive tech, which hears only the stone', () => {
    wrap(<Headstone name="Ann Example" playerId="ann" standing={standings().ann} funeral />)
    expect(document.querySelector('.funeral.is-playing')).not.toBeNull()
    const face = document.querySelector('.funeral-face')
    expect(face).toHaveAttribute('aria-hidden', 'true')
    expect(face?.querySelectorAll('img').length).toBeGreaterThan(1)
    expect(screen.getAllByRole('img')).toHaveLength(1)
    expect(screen.getByRole('img')).toHaveClass('funeral-stone')
  })

  it('dims the house through a portal on the body, never a box on the card', () => {
    wrap(<Headstone name="Ann Example" playerId="ann" standing={standings().ann} funeral />)
    const house = document.body.querySelector(':scope > .funeral-house')
    expect(house).not.toBeNull()
    expect(house).toHaveAttribute('aria-hidden', 'true')
    expect(house!.querySelector('.funeral-house-lights')).not.toBeNull()
    expect(document.querySelector('.funeral .funeral-house-lights')).toBeNull()
  })

  it('keeps the house lights up when nothing is playing', () => {
    wrap(<Headstone name="Ann Example" playerId="ann" standing={standings().ann} />)
    expect(document.body.querySelector('.funeral-house-lights')).toBeNull()
  })

  it('raises a sheet ghost with the face in its head', () => {
    wrap(<Headstone name="Ann Example" playerId="ann" standing={standings().ann} funeral />)
    const ghost = document.querySelector('.funeral-ghost')!
    expect(ghost.querySelector('svg.funeral-sheet path')).not.toBeNull()
    expect(ghost.querySelector('.funeral-ghost-face img')).not.toBeNull()
  })

  it('is cut from stone: a tablet on a plinth, with the inscription on its polished panel', () => {
    wrap(<Headstone name="Ann Example" playerId="ann" standing={standings().ann} size="hero" />)
    const stone = screen.getByRole('img')
    const svg = stone.querySelector('svg.headstone-svg')!
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg.querySelectorAll('feTurbulence').length).toBeGreaterThanOrEqual(2)
    expect(within(stone).getByText('Ann Example').closest('.headstone-face')).not.toBeNull()
  })

  it('prints the morning paper from the record', () => {
    wrap(<Headstone name="Ann Example" playerId="ann" standing={standings().ann} funeral />)
    expect(document.querySelector('.funeral-paper-head')).toHaveTextContent(
      'Ann Example trusts Seahawks on the road, dies',
    )
    expect(document.querySelector('.funeral-paper-sub')).toHaveTextContent(
      'Commanders 27, Seahawks 17',
    )
  })

  it('drops the murder weapon with the final score', () => {
    wrap(<Headstone name="Ann Example" playerId="ann" standing={standings().ann} funeral />)
    expect(document.querySelector('.funeral-score')).toHaveTextContent(
      'Finally done in by WAS 27–17',
    )
  })

  it('breaks every face its own way', () => {
    wrap(<Headstone name="Ann Example" playerId="ann" standing={standings().ann} funeral />)
    const ann = [...document.querySelectorAll('.funeral-crack')].map((p) => p.getAttribute('d'))
    cleanup()
    wrap(<Headstone name="Bob Example" playerId="bob" standing={standings().ann} funeral />)
    const bob = [...document.querySelectorAll('.funeral-crack')].map((p) => p.getAttribute('d'))
    expect(ann).toHaveLength(9)
    expect(bob).not.toEqual(ann)
  })

  it('brings rain, letterbox bars and lightning through the portal', () => {
    wrap(<Headstone name="Ann Example" playerId="ann" standing={standings().ann} funeral />)
    expect(document.querySelectorAll('.funeral-rain span').length).toBeGreaterThan(20)
    const house = document.body.querySelector(':scope > .funeral-house')!
    expect(house.querySelectorAll('.funeral-bar')).toHaveLength(2)
    expect(house.querySelector('.funeral-lightning')).not.toBeNull()
  })

  it('sends the crow in during the scene, and leaves it perched after', () => {
    vi.useFakeTimers()
    try {
      wrap(<Headstone name="Ann Example" playerId="ann" standing={standings().ann} funeral />)
      expect(document.querySelector('.funeral-crow')).toHaveClass('is-landing')
      act(() => vi.advanceTimersByTime(FUNERAL_MS))
      const crow = document.querySelector('.funeral-crow')
      expect(crow).not.toBeNull()
      expect(crow).not.toHaveClass('is-landing')
    } finally {
      vi.useRealTimers()
    }
  })

  it('has no crow on an old grave', () => {
    wrap(<Headstone name="Ann Example" playerId="ann" standing={standings().ann} />)
    expect(document.querySelector('.funeral-crow')).toBeNull()
  })

  it('shatters into sixteen pieces, and leaves a ghost', () => {
    wrap(<Headstone name="Ann Example" playerId="ann" standing={standings().ann} funeral />)
    expect(document.querySelectorAll('.funeral-shard')).toHaveLength(16)
    expect(document.querySelector('.funeral-ghost img')).not.toBeNull()
  })

  it('steps aside for the plain stone once the scene is over', () => {
    vi.useFakeTimers()
    try {
      wrap(<Headstone name="Ann Example" playerId="ann" standing={standings().ann} funeral />)
      expect(document.querySelector('[data-funeral]')).toHaveAttribute('data-funeral', 'playing')
      act(() => vi.advanceTimersByTime(FUNERAL_MS))
      expect(document.querySelector('[data-funeral]')).toHaveAttribute('data-funeral', 'done')
      expect(document.querySelector('.funeral')).toBeNull()
      expect(screen.getByRole('img', { name: /Headstone of Ann Example/ })).not.toHaveClass(
        'funeral-stone',
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('skips straight to the stone for viewers who prefer reduced motion', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }))
    try {
      wrap(<Headstone name="Ann Example" playerId="ann" standing={standings().ann} funeral />)
      expect(document.querySelector('[data-funeral]')).toHaveAttribute('data-funeral', 'skipped')
      expect(document.querySelector('.funeral')).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('Headstone funeral timing', () => {
  /** A stand-in IntersectionObserver the test can scroll by hand. */
  let fire: (visible: boolean) => void = () => {}
  let disconnected = false
  afterEach(() => {
    vi.unstubAllGlobals()
    disconnected = false
  })
  function stubObserver() {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) {
          fire = (visible) =>
            cb([{ isIntersecting: visible } as IntersectionObserverEntry], this as never)
        }
        observe() {}
        disconnect() {
          disconnected = true
        }
      },
    )
  }

  it('waits, face intact and stone underground, until the grave is scrolled into view', () => {
    stubObserver()
    wrap(<Headstone name="Ann Example" playerId="ann" standing={standings().ann} funeral />)
    const grave = document.querySelector('[data-funeral]')!
    expect(grave).toHaveAttribute('data-funeral', 'waiting')
    expect(document.querySelector('.funeral')).not.toHaveClass('is-playing')
    expect(screen.getByRole('img')).toHaveClass('funeral-stone')

    act(() => fire(false))
    expect(grave).toHaveAttribute('data-funeral', 'waiting')

    act(() => fire(true))
    expect(grave).toHaveAttribute('data-funeral', 'playing')
    expect(document.querySelector('.funeral')).toHaveClass('is-playing')
    // Plays once: it stops watching, so scrolling back and forth does not restart it.
    expect(disconnected).toBe(true)
  })

  it('does not watch at all when there is no funeral', () => {
    stubObserver()
    wrap(<Headstone name="Ann Example" playerId="ann" standing={standings().ann} />)
    expect(document.querySelector('[data-funeral]')).toBeNull()
    expect(screen.getByRole('img')).not.toHaveClass('funeral-stone')
  })
})

describe('a row of graves', () => {
  it('gives each grave its own stone, fixed per player', () => {
    const ids = [
      'craig-mowers',
      'jared-marks',
      'joseph-tomczuk',
      'nate-adams',
      'phyllis-collins',
      'don-turner',
    ]
    const variants = ids.map(graveVariant)
    // Same player, same stone, every time.
    expect(ids.map(graveVariant)).toEqual(variants)
    expect(new Set(variants.map((v) => v.shape)).size).toBe(3)
    expect(new Set(variants.map((v) => v.tint)).size).toBe(3)
    expect(new Set(variants.map((v) => v.lean)).size).toBeGreaterThan(3)
    for (const v of variants) {
      expect(Math.abs(v.lean)).toBeLessThanOrEqual(2)
    }
  })

  it('carves the variant into the stone it renders', () => {
    wrap(
      <Headstone name="Nate Adams" playerId="nate-adams" standing={standings().ann} size="hero" />,
    )
    const v = graveVariant('nate-adams')
    const lean = document.querySelector('.headstone-lean') as HTMLElement
    expect(lean.style.getPropertyValue('--lean')).toBe(`${v.lean}deg`)
  })

  it('perches the crow on the shoulder the variant picks', () => {
    vi.useFakeTimers()
    try {
      wrap(<Headstone name="Nate Adams" playerId="nate-adams" standing={standings().ann} funeral />)
      act(() => vi.advanceTimersByTime(FUNERAL_MS))
      const crow = document.querySelector('.funeral-crow')!
      expect(crow.classList.contains('is-left')).toBe(
        graveVariant('nate-adams').crowSide === 'left',
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('dims the house once for the whole row, not once per grave', () => {
    wrap(
      <>
        <Headstone name="Ann Example" playerId="ann" standing={standings().ann} funeral />
        <Headstone name="Bob Example" playerId="bob" standing={standings().ann} funeral />
        <Headstone name="Cal Example" playerId="cal" standing={standings().ann} funeral />
      </>,
    )
    expect(document.querySelectorAll('.funeral.is-playing')).toHaveLength(3)
    expect(document.body.querySelectorAll(':scope > .funeral-house')).toHaveLength(1)
  })
})

describe('the cascade', () => {
  let fire: (visible: boolean) => void = () => {}
  afterEach(() => vi.unstubAllGlobals())

  it("holds a grave's funeral for its delay after it comes into view", () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) {
          fire = (visible) =>
            cb([{ isIntersecting: visible } as IntersectionObserverEntry], this as never)
        }
        observe() {}
        disconnect() {}
      },
    )
    try {
      wrap(
        <Headstone
          name="Ann Example"
          playerId="ann"
          standing={standings().ann}
          funeral
          funeralDelay={2.2}
        />,
      )
      const grave = document.querySelector('[data-funeral]')!
      act(() => fire(true))
      expect(grave).toHaveAttribute('data-funeral', 'waiting')
      act(() => vi.advanceTimersByTime(2100))
      expect(grave).toHaveAttribute('data-funeral', 'waiting')
      act(() => vi.advanceTimersByTime(200))
      expect(grave).toHaveAttribute('data-funeral', 'playing')
    } finally {
      vi.useRealTimers()
    }
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
    wrap(
      <PlayerCard standing={standings().bob} profile={profile('bob', 'Bob Example')} pickVisible />,
    )
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
    expect(document.querySelector('.funeral')).not.toBeNull()
  })
})
