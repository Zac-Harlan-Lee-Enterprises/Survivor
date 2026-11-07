// @vitest-environment jsdom
import { act, render, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlayerStanding } from '@/domain'
import { useConfetti, wreathOf } from './useConfetti'

const { confetti } = vi.hoisted(() => ({ confetti: vi.fn() }))
vi.mock('canvas-confetti', () => ({ default: confetti }))

const ANN = { playerId: 'ann', history: [] } as unknown as PlayerStanding

function Party({ active, after }: { active: boolean; after?: number }) {
  const celebrate = useConfetti(active ? [ANN] : [], { after })
  return <section ref={celebrate}>Champion</section>
}

/** A controllable IntersectionObserver: `show()` puts every watched element on screen. */
function stubObserver() {
  const live = new Set<{ cb: IntersectionObserverCallback; els: Element[] }>()
  class Stub {
    entry: { cb: IntersectionObserverCallback; els: Element[] }
    constructor(cb: IntersectionObserverCallback) {
      this.entry = { cb, els: [] }
      live.add(this.entry)
    }
    observe(el: Element) {
      this.entry.els.push(el)
    }
    disconnect() {
      live.delete(this.entry)
    }
  }
  vi.stubGlobal('IntersectionObserver', Stub)
  return {
    show: () =>
      act(() => {
        for (const o of [...live])
          o.cb(
            o.els.map((target) => ({ target, isIntersecting: true }) as IntersectionObserverEntry),
            {} as IntersectionObserver,
          )
      }),
  }
}

const settle = () => act(() => new Promise((r) => setTimeout(r, 20)))

describe('useConfetti', () => {
  beforeEach(() => {
    confetti.mockReset()
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as typeof window.matchMedia
    window.requestAnimationFrame = () => 0
  })
  afterEach(() => vi.unstubAllGlobals())

  it('waits until the winner is on screen, then fires', async () => {
    const screen = stubObserver()
    render(<Party active />)
    await settle()
    expect(confetti).not.toHaveBeenCalled()
    screen.show()
    await waitFor(() => expect(confetti).toHaveBeenCalled())
  })

  // StrictMode mounts, cleans up and re-runs every effect in development. The
  // burst must survive that, or the celebration never plays locally.
  it('fires under StrictMode', async () => {
    const screen = stubObserver()
    render(
      <StrictMode>
        <Party active />
      </StrictMode>,
    )
    screen.show()
    await waitFor(() => expect(confetti).toHaveBeenCalled())
  })

  it('can wait a moment once the winner is seen (for the banner to unroll)', async () => {
    const screen = stubObserver()
    render(<Party active after={200} />)
    screen.show()
    await settle()
    expect(confetti).not.toHaveBeenCalled()
    await waitFor(() => expect(confetti).toHaveBeenCalled())
  })

  it('fires once per page load, not every time the winner scrolls back into view', async () => {
    const screen = stubObserver()
    render(<Party active />)
    screen.show()
    await waitFor(() => expect(confetti).toHaveBeenCalledTimes(3))
    screen.show()
    await settle()
    expect(confetti).toHaveBeenCalledTimes(3)
  })

  it('fires again on the next page load', async () => {
    const screen = stubObserver()
    const first = render(<Party active />)
    screen.show()
    await waitFor(() => expect(confetti).toHaveBeenCalledTimes(3))
    first.unmount()
    render(<Party active />)
    screen.show()
    await waitFor(() => expect(confetti).toHaveBeenCalledTimes(6))
  })

  it('stays still with no winner, or when the viewer prefers reduced motion', async () => {
    const screen = stubObserver()
    render(<Party active={false} />)
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as typeof window.matchMedia
    render(<Party active />)
    screen.show()
    await settle()
    expect(confetti).not.toHaveBeenCalled()
  })
})

describe('wreathOf', () => {
  it('is every team they picked, in week order, the weeks that cost a life marked', () => {
    const week = (week: number, teamId: string | null, outcome: string) => ({
      week,
      pick: teamId ? { teamId } : null,
      outcome,
    })
    const s = {
      history: [
        week(1, 'KC', 'win'),
        week(2, null, 'missing'),
        week(3, 'DAL', 'loss'),
        week(4, 'WAS', 'tie'),
        week(5, 'BUF', 'void'),
        week(6, 'DET', 'pending'),
        week(7, 'SF', 'win'),
      ],
    } as unknown as PlayerStanding
    expect(wreathOf(s, '/Survivor/')).toEqual([
      { src: '/Survivor/team-logos/kc.png', won: true },
      { src: '/Survivor/team-logos/dal.png', won: false },
      { src: '/Survivor/team-logos/was.png', won: false },
      { src: '/Survivor/team-logos/det.png', won: true },
      { src: '/Survivor/team-logos/sf.png', won: true },
    ])
  })
})
