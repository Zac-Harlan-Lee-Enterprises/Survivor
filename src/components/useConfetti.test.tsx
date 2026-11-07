// @vitest-environment jsdom
import { act, render, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useConfetti } from './useConfetti'

const { confetti } = vi.hoisted(() => ({ confetti: vi.fn() }))
vi.mock('canvas-confetti', () => ({ default: confetti }))

function Party({ active }: { active: boolean }) {
  const celebrate = useConfetti(active)
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
