/**
 * Music for a scene: a cue that fades in when it starts and out when it is
 * stopped, and the one switch that silences it.
 *
 * Browsers will not play sound on a page nobody has touched yet. When that is
 * why a cue cannot start, it waits for the first tap, click or key and comes
 * in then, at the point it would have reached (so it stays with the picture),
 * and only while it is still wanted. A file that is missing or will not play
 * is simply silence: the scene never waits for its music.
 *
 * While any cue is wanted, a small speaker switch sits in the corner of the
 * screen. It silences everything (and remembers that, on this device, for
 * next time) or, pressed again, brings it back in where the scene has got to.
 * It is also the way in when the browser held the sound back: pressing it
 * counts as the touch the browser was waiting for.
 */
export interface Cue {
  start(): void
  stop(fadeMs?: number): void
}

const GESTURES = ['pointerdown', 'keydown', 'touchstart'] as const
const KEY = 'survivor.music.muted'

let silenced = readSilenced()
const live = new Set<Live>()
let button: HTMLButtonElement | null = null

interface Live {
  sounding(): boolean
  resume(): void
  hush(): void
}

function readSilenced() {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

function saveSilenced(v: boolean) {
  try {
    localStorage.setItem(KEY, v ? '1' : '0')
  } catch {
    // (Private windows and blocked storage: it just will not be remembered.)
  }
}

const SPEAKER = '<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/>'
const WAVES =
  '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'
const CROSS =
  '<path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'

/** Whether anything can be heard right now. */
function audible() {
  return !silenced && [...live].some((c) => c.sounding())
}

/** The switch: shown while any cue is wanted, saying what pressing it will do. */
function render() {
  if (typeof document === 'undefined') return
  if (live.size === 0) {
    button?.remove()
    button = null
    return
  }
  if (!button) {
    button = document.createElement('button')
    button.type = 'button'
    button.className = 'sound-switch'
    button.addEventListener('click', toggle)
    document.body.append(button)
  }
  const on = audible()
  button.setAttribute('aria-label', on ? 'Silence the music' : 'Play the music')
  button.setAttribute('aria-pressed', on ? 'false' : 'true')
  button.title = on ? 'Silence the music' : 'Play the music'
  button.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">${SPEAKER}${on ? WAVES : CROSS}</svg>`
}

function toggle() {
  if (audible()) {
    silenced = true
    saveSilenced(true)
    live.forEach((c) => c.hush())
  } else {
    silenced = false
    saveSilenced(false)
    live.forEach((c) => c.resume())
  }
  render()
}

/** (A press on the switch itself is the switch's business, not a late start.) */
const onSwitch = (e: Event) => e.target instanceof Element && !!e.target.closest('.sound-switch')

export function cue(src: string, { volume = 0.55, fadeIn = 900, loop = false } = {}): Cue {
  if (typeof Audio === 'undefined') return { start() {}, stop() {} }
  const el = new Audio()
  el.preload = 'auto'
  el.loop = loop
  el.src = src
  let wanted = false
  let startedAt = 0
  let ramp = 0
  // (Some browsers return nothing from play(), or throw: the same as a refusal.)
  const play = () => Promise.resolve().then(() => el.play())

  const fade = (to: number, ms: number, then?: () => void) => {
    cancelAnimationFrame(ramp)
    const from = el.volume
    const t0 = performance.now()
    const step = (now: number) => {
      const u = ms > 0 ? Math.min(1, (now - t0) / ms) : 1
      el.volume = Math.max(0, Math.min(1, from + (to - from) * u))
      if (u < 1) ramp = requestAnimationFrame(step)
      else then?.()
    }
    ramp = requestAnimationFrame(step)
  }
  const unarm = () => GESTURES.forEach((g) => document.removeEventListener(g, late, true))
  const arm = () =>
    GESTURES.forEach((g) => document.addEventListener(g, late, { capture: true, passive: true }))

  /** Come in where the scene has got to (looping, wherever the loop is). */
  const join = () => {
    if (!wanted || silenced) return
    let at = (performance.now() - startedAt) / 1000
    const d = el.duration
    if (Number.isFinite(d) && d > 0) {
      if (loop) at %= d
      else if (at >= d) return
    }
    el.currentTime = at
    el.volume = 0
    play().then(
      () => {
        fade(volume, fadeIn)
        render()
      },
      () => {},
    )
  }
  // Allowed to play at last.
  function late(e: Event) {
    if (onSwitch(e)) return
    unarm()
    join()
  }

  const me: Live = {
    sounding: () => wanted && !el.paused,
    resume: () => {
      unarm()
      join()
    },
    hush: () => {
      unarm()
      if (!el.paused) fade(0, 300, () => el.pause())
    },
  }

  return {
    start() {
      wanted = true
      startedAt = performance.now()
      live.add(me)
      render()
      if (silenced) return
      el.currentTime = 0
      el.volume = 0
      play().then(
        () => {
          fade(volume, fadeIn)
          render()
        },
        (e: unknown) => {
          // Not allowed yet: come in on the first touch. (Anything else, such
          // as a missing file, is silence.)
          if (e instanceof DOMException && e.name === 'NotAllowedError') arm()
        },
      )
    },
    stop(fadeMs = 1500) {
      wanted = false
      unarm()
      live.delete(me)
      render()
      if (el.paused) return
      fade(0, fadeMs, () => el.pause())
    },
  }
}
