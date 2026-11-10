// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { FLASH_GAP, flashTimes, fireworks, flashes } from './finale'

describe('camera flashes', () => {
  it('never come closer together than a third of a second: at most three in any second', () => {
    for (let run = 0; run < 200; run++) {
      const times = flashTimes(9, 3200)
      expect(times).toHaveLength(9)
      for (let i = 1; i < times.length; i++)
        expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(FLASH_GAP - 1)
      for (const t of times) {
        const inASecond = times.filter((u) => u >= t && u < t + 1000)
        expect(inASecond.length).toBeLessThanOrEqual(3)
      }
      expect(times.at(-1)!).toBeLessThanOrEqual(3200)
    }
  })

  it('without animation support, do nothing and leave nothing behind', () => {
    const stop = flashes(document)
    expect(document.querySelector('.camera-flashes')).toBeNull()
    stop()
  })
})

describe('fireworks', () => {
  it('without a canvas, do nothing and leave nothing behind', () => {
    // (jsdom has no 2D canvas.)
    const stop = fireworks(document)
    expect(document.querySelector('.fireworks, .fireworks-sky')).toBeNull()
    stop()
  })
})
