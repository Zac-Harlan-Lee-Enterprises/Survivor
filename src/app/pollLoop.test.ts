import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startPollLoop, type Visibility } from './pollLoop'

/** A stand-in for `document`: visibility a test can flip. */
function tab() {
  let listener: (() => void) | undefined
  const doc = {
    hidden: false,
    addEventListener: (_: 'visibilitychange', l: () => void) => void (listener = l),
    removeEventListener: () => void (listener = undefined),
  }
  const set = (hidden: boolean) => {
    doc.hidden = hidden
    listener?.()
  }
  return { doc: doc as Visibility, hide: () => set(true), show: () => set(false) }
}

/** A poll whose requests stay in the air until the test lands them. */
function slowPoll() {
  const landing: (() => void)[] = []
  const poll = vi.fn(() => new Promise<void>((resolve) => landing.push(resolve)))
  return { poll, land: async () => (landing.shift()?.(), await vi.advanceTimersByTimeAsync(0)) }
}

const OPTS = { pollMs: 45_000, backoffMs: 180_000 }

describe('the live-score poll loop', () => {
  beforeEach(() => void vi.useFakeTimers())
  afterEach(() => void vi.useRealTimers())

  it('polls at once, then every interval, and stops when told', async () => {
    const { doc } = tab()
    const poll = vi.fn(async () => {})
    const stop = startPollLoop(poll, { ...OPTS, doc })
    await vi.advanceTimersByTimeAsync(0)
    expect(poll).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(45_000)
    expect(poll).toHaveBeenCalledTimes(2)
    stop()
    await vi.advanceTimersByTimeAsync(10 * 45_000)
    expect(poll).toHaveBeenCalledTimes(2)
  })

  it('backs off after a failure', async () => {
    const { doc } = tab()
    const poll = vi.fn(async () => Promise.reject(new Error('offline')))
    startPollLoop(poll, { ...OPTS, doc })
    await vi.advanceTimersByTimeAsync(45_000)
    expect(poll).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(180_000)
    expect(poll).toHaveBeenCalledTimes(2)
  })

  it('does not poll a hidden tab, even when a request was in the air as it hid', async () => {
    const { doc, hide } = tab()
    const { poll, land } = slowPoll()
    startPollLoop(poll, { ...OPTS, doc })
    expect(poll).toHaveBeenCalledTimes(1)
    hide()
    await land()
    await vi.advanceTimersByTimeAsync(10 * 45_000)
    expect(poll).toHaveBeenCalledTimes(1)
  })

  it('keeps one chain however often the tab is hidden and shown mid-request', async () => {
    const { doc, hide, show } = tab()
    const { poll, land } = slowPoll()
    startPollLoop(poll, { ...OPTS, doc })
    // Three round trips away and back, each while a request is still out.
    for (let i = 0; i < 3; i++) {
      hide()
      show()
    }
    expect(poll).toHaveBeenCalledTimes(4)
    for (let i = 0; i < 4; i++) await land()
    // One interval later there is one more poll, not four.
    await vi.advanceTimersByTimeAsync(45_000)
    expect(poll).toHaveBeenCalledTimes(5)
  })
})
