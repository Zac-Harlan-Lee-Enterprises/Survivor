// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { crown, wreathSpots } from './crowning'

function champion() {
  const section = document.createElement('section')
  section.innerHTML = '<img class="rounded-full" alt="Headshot of Ann" />'
  document.body.append(section)
  return section
}

describe('crown', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('without animation support, goes straight to the finale and leaves the gold ring', () => {
    const section = champion()
    const finale = vi.fn()
    crown(section, finale)
    expect(finale).toHaveBeenCalledOnce()
    expect(section.querySelector('img')!.hasAttribute('data-crowned')).toBe(true)
    expect(document.querySelector('.crowning')).toBeNull()
  })

  describe('with animation support', () => {
    const stubAnimate = () => {
      const fake = { cancel: vi.fn(), finished: Promise.resolve() }
      Element.prototype.animate = vi.fn(() => fake as unknown as Animation)
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
      window.requestAnimationFrame = () => 0
      window.cancelAnimationFrame = () => {}
    }

    it('dims the page round the winner, then lights up, fires the finale and keeps the ring', () => {
      vi.useFakeTimers()
      stubAnimate()
      const section = champion()
      const finale = vi.fn()
      crown(section, finale)
      const stage = document.querySelector('.crowning')!
      expect(stage.getAttribute('aria-hidden')).toBe('true')
      expect(stage.querySelector('.crowning-dark')).not.toBeNull()
      expect(stage.querySelector('.crowning-beam')).not.toBeNull()
      expect(stage.querySelectorAll('.crowning-ring')).toHaveLength(1)
      expect(finale).not.toHaveBeenCalled()
      // Lights up a beat after the wreath is in, not a long wait in the dark.
      vi.advanceTimersByTime(6500)
      expect(finale).toHaveBeenCalledOnce()
      expect(section.querySelector('img')!.hasAttribute('data-crowned')).toBe(true)
    })

    it('rings every co-champion', () => {
      stubAnimate()
      const section = champion()
      section.insertAdjacentHTML('beforeend', '<img class="rounded-full" alt="Headshot of Bo" />')
      crown(section, () => {})
      expect(document.querySelectorAll('.crowning-ring')).toHaveLength(2)
    })

    it('the fanfare comes in with the light and plays on after the scene; leaving the page stops it', async () => {
      vi.useFakeTimers()
      stubAnimate()
      const fanfare = { start: vi.fn(), stop: vi.fn() }
      const stop = crown(champion(), () => {}, { fanfare })
      await vi.advanceTimersByTimeAsync(3000)
      expect(fanfare.start).toHaveBeenCalledOnce()
      await vi.advanceTimersByTimeAsync(30000)
      expect(fanfare.stop).not.toHaveBeenCalled()
      stop()
      expect(fanfare.stop).toHaveBeenCalled()
    })

    it('leaving the page mid-scene clears the stage and skips the finale', () => {
      vi.useFakeTimers()
      stubAnimate()
      const finale = vi.fn()
      const stop = crown(champion(), finale)
      stop()
      vi.advanceTimersByTime(10000)
      expect(document.querySelector('.crowning')).toBeNull()
      expect(finale).not.toHaveBeenCalled()
    })
  })
})

describe('wreathSpots', () => {
  it('climbs both sides from the stem, never crossing the top, smaller towards the tips', () => {
    const spots = wreathSpots(9, 50)
    expect(spots).toHaveLength(9)
    // Alternating sides: week 1 on the left, week 2 on the right.
    expect(spots[0]!.x).toBeLessThan(0)
    expect(spots[1]!.x).toBeGreaterThan(0)
    // Week 1 at the stem (low); the last weeks near the top.
    expect(spots[0]!.y).toBeGreaterThan(40)
    expect(spots[8]!.y).toBeLessThan(0)
    expect(spots[8]!.size).toBeLessThan(spots[0]!.size)
    // Nothing sits on the crown of the head: a gap between the tips.
    for (const s of spots) expect(Math.abs(s.x)).toBeGreaterThan(10)
  })
})
