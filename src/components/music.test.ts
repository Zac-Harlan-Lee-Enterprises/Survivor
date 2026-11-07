// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cue, type Cue } from './music'

/** An Audio stand-in: `refuse` decides what play() does the first time. */
function stubAudio(refuse?: string) {
  const plays: number[] = []
  const all: FakeAudio[] = []
  let first = true
  class FakeAudio {
    src = ''
    preload = ''
    loop = false
    volume = 1
    currentTime = 0
    duration = 60
    paused = true
    constructor() {
      all.push(this)
    }
    play() {
      plays.push(this.currentTime)
      if (first && refuse) {
        first = false
        return Promise.reject(new DOMException('no', refuse))
      }
      this.paused = false
      return Promise.resolve()
    }
    pause() {
      this.paused = true
    }
  }
  vi.stubGlobal('Audio', FakeAudio)
  return { plays, all }
}
const flush = () => new Promise((r) => setTimeout(r, 0))
const sw = () => document.querySelector<HTMLButtonElement>('.sound-switch')

describe('cue', () => {
  const made: Cue[] = []
  const track = (c: Cue) => (made.push(c), c)

  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) =>
      setTimeout(() => f(performance.now() + 1e5), 0),
    )
  })
  afterEach(async () => {
    // (The switch and its state are shared: leave them as we found them.)
    if (sw()?.getAttribute('aria-pressed') === 'true') sw()!.click()
    made.splice(0).forEach((c) => c.stop(0))
    await flush()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('plays from the top when it starts', async () => {
    const { plays } = stubAudio()
    track(cue('a.m4a')).start()
    await flush()
    expect(plays).toEqual([0])
  })

  it('when the browser will not play yet, comes in on the first touch, where the scene has got to', async () => {
    const { plays } = stubAudio('NotAllowedError')
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000)
    track(cue('a.m4a')).start()
    await flush()
    expect(plays).toHaveLength(1)
    now.mockReturnValue(4500)
    document.dispatchEvent(new Event('pointerdown'))
    await flush()
    expect(plays).toEqual([0, 3.5])
  })

  it('looping, comes in wherever the loop has got to', async () => {
    const { plays, all } = stubAudio('NotAllowedError')
    const now = vi.spyOn(performance, 'now').mockReturnValue(0)
    track(cue('a.m4a', { loop: true })).start()
    await flush()
    expect(all[0]!.loop).toBe(true)
    now.mockReturnValue(75_000) // 75 s into a 60 s loop
    document.dispatchEvent(new Event('keydown'))
    await flush()
    expect(plays.at(-1)).toBe(15)
  })

  it('stays silent if stopped before anyone touches the page', async () => {
    const { plays } = stubAudio('NotAllowedError')
    const music = track(cue('a.m4a'))
    music.start()
    await flush()
    music.stop()
    document.dispatchEvent(new Event('keydown'))
    await flush()
    expect(plays).toHaveLength(1)
  })

  it('a file that will not play is silence, and waits for nothing', async () => {
    const { plays } = stubAudio('NotSupportedError')
    track(cue('missing.m4a')).start()
    await flush()
    document.dispatchEvent(new Event('pointerdown'))
    await flush()
    expect(plays).toHaveLength(1)
  })

  describe('the switch', () => {
    it('is there while music is wanted, and gone when it stops', async () => {
      stubAudio()
      const music = track(cue('a.m4a'))
      expect(sw()).toBeNull()
      music.start()
      await flush()
      expect(sw()!.getAttribute('aria-label')).toBe('Silence the music')
      music.stop(0)
      expect(sw()).toBeNull()
    })

    it('silences the music, remembers it, and brings it back where the scene has got to', async () => {
      const { all, plays } = stubAudio()
      const now = vi.spyOn(performance, 'now').mockReturnValue(0)
      track(cue('a.m4a')).start()
      await flush()
      sw()!.click()
      await flush()
      expect(all[0]!.paused).toBe(true)
      expect(localStorage.getItem('survivor.music.muted')).toBe('1')
      expect(sw()!.getAttribute('aria-label')).toBe('Play the music')
      now.mockReturnValue(9000)
      sw()!.click()
      await flush()
      expect(all[0]!.paused).toBe(false)
      expect(plays.at(-1)).toBe(9)
      expect(localStorage.getItem('survivor.music.muted')).toBe('0')
    })

    it('once silenced, the next scene starts silent', async () => {
      const { plays } = stubAudio()
      track(cue('a.m4a')).start()
      await flush()
      sw()!.click()
      track(cue('b.m4a')).start()
      await flush()
      expect(plays).toHaveLength(1)
      expect(sw()!.getAttribute('aria-pressed')).toBe('true')
    })

    it('when the browser held the sound back, pressing it starts the music (and only that)', async () => {
      const { plays, all } = stubAudio('NotAllowedError')
      track(cue('a.m4a')).start()
      await flush()
      expect(sw()!.getAttribute('aria-label')).toBe('Play the music')
      sw()!.dispatchEvent(new Event('pointerdown', { bubbles: true }))
      sw()!.click()
      await flush()
      expect(plays).toHaveLength(2)
      expect(all[0]!.paused).toBe(false)
    })
  })
})
