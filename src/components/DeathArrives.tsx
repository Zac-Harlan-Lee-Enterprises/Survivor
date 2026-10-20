import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { PlayerStanding } from '@/domain'
import { getConfig } from '@/config/env'
import { frameAt, planEntrance, routeKeyframes, type Film } from '@/lib/deathFilm'
import FRAMES from './deathFrames.json'

const FILM = FRAMES as Film

/** The pause, once the last funeral is over, before he comes. */
const HUSH = 1800
/** How long the world takes to drain of colour, and the rain to freeze in it. */
const DRAIN = 1200
/** Colour and rain coming back once he has gone. */
const RETURN = 1600

type Phase = 'waiting' | 'arriving' | 'gone' | 'off'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Rain for the scene: placed once, so it freezes the same way every time. */
const RAIN = Array.from({ length: 70 }, (_, i) => {
  const r = (n: number) => (((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1
  return {
    left: `${(r(1) * 104 - 2).toFixed(1)}%`,
    length: Math.round(14 + r(2) * 22),
    opacity: 0.25 + r(3) * 0.4,
    duration: 650 + r(4) * 350,
    phase: r(5),
  }
})

/**
 * He arrives. When the week's last funeral is over and the graves are on
 * screen, the world stops for him: everything drains to grey and goes nearly
 * dark, rain falls and then hangs frozen in the air, every other animation on
 * the page holds still. Death walks in, unhurried, in a black suit, his hand
 * on the silver knob of his cane; as he passes, the crows lift off the fresh
 * stones and frost creeps up them. He stops. His eyes find you, then his head
 * turns after them; he comes round to face you, sets the cane before him and
 * rests both hands on it, and regards you for a long moment. Then he turns
 * away (his eyes the last to leave you) and walks on, off the edge of the
 * page. Colour and rain come back; the frost stays.
 *
 * He is rendered, not drawn: BibleGame's figure engine (a MakeHuman body, his
 * suit cut to it, a walk planned foot by foot) by scripts/art/death_scene.py,
 * packed by scripts/art/death_film.py. Its frames are drawn onto a canvas in
 * step with his route across the page (src/lib/deathFilm.ts), so his feet stay
 * where they land.
 *
 * Once per page load, the same on any screen. Viewers who prefer reduced
 * motion get no funerals, so no Death.
 */
export function DeathArrives({ graves }: { graves: PlayerStanding[] }) {
  const marker = useRef<HTMLSpanElement>(null)
  const scene = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<Phase>(() => (prefersReducedMotion() ? 'off' : 'waiting'))
  const ids = graves.map((g) => g.playerId).join(',')
  const off = phase === 'off'
  const { basePath } = getConfig()

  useEffect(() => {
    if (off || !ids) return
    const stage = marker.current?.parentElement
    if (!stage) return
    let cancelled = false
    const running = new Set<Animation>()
    const play = (el: Element, frames: Keyframe[], opts: KeyframeAnimationOptions) => {
      const a = el.animate(frames, { fill: 'forwards', ...opts })
      running.add(a)
      return a
    }
    const done = (a: Animation) =>
      a.finished.then(
        () => !cancelled,
        () => false,
      )
    const doc = stage.ownerDocument
    // His frames, fetched while the funerals play (drawn later, a sheet at a time).
    const sheets = FILM.sheets.map((src) => {
      const img = new Image()
      img.src = `${basePath}${src}`
      return img
    })
    const ready = (k: number) => {
      const img = sheets[k]
      return img ? img.decode().catch(() => undefined) : Promise.resolve()
    }
    void (async () => {
      for (const id of ids.split(',')) {
        const stone = await finished(stage, id, () => cancelled)
        if (cancelled) return
        if (!stone) return setPhase('off')
      }
      if (!(await inView(stage, () => cancelled))) return
      const root = scene.current
      if (!root || typeof root.animate !== 'function') return setPhase('off')
      // A beat of quiet after the last funeral, then he comes. (A real wait, not
      // an animation: nothing that fast-forwards the page should summon him.)
      await Promise.all([new Promise((r) => setTimeout(r, HUSH)), ready(0)])
      if (cancelled) return
      setPhase('arriving')
      doc.documentElement.classList.add('death-is-here')

      const world = root.querySelector('.death-world')!
      const rain = root.querySelector('.death-rain')!
      const me = root.querySelector<HTMLElement>('.death-figure')!
      const canvas = root.querySelector<HTMLCanvasElement>('.death-sprite')!
      // The world drains; the rain falls, then hangs where it is.
      play(world, [{ opacity: 0 }, { opacity: 1 }], { duration: DRAIN, easing: 'ease-in' })
      play(rain, [{ opacity: 0 }, { opacity: 1 }], { duration: DRAIN / 2 })
      const drops = [...rain.children].map((drop, i) => {
        const d = RAIN[i]!
        const a = play(
          drop,
          [{ transform: 'translateY(-20vh)' }, { transform: 'translateY(120vh)' }],
          { duration: d.duration, iterations: Infinity, fill: 'none' },
        )
        a.currentTime = d.phase * d.duration
        return a
      })
      if (!(await done(play(root, [{}, {}], { duration: DRAIN })))) return
      drops.forEach((a) => a.pause())

      // His size and his route: tall and close, in from the dark on the left.
      const vw = doc.documentElement.clientWidth
      const plan = planEntrance(FILM, vw, window.innerHeight)
      me.style.width = `${plan.width}px`
      me.style.height = `${plan.height}px`
      canvas.width = FILM.frameWidth
      canvas.height = FILM.frameHeight
      const ctx = canvas.getContext('2d')
      const route = play(me, routeKeyframes(FILM, plan), { duration: plan.durationMs })

      // Each frame drawn as its moment comes round (and the next sheet readied).
      let shown = -1
      const draw = () => {
        if (cancelled) return
        const k = frameAt(FILM, plan, Number(route.currentTime ?? 0))
        if (k !== shown && ctx) {
          const f = FILM.frames[k]!
          const img = sheets[f.s]
          if (img?.complete && img.naturalWidth > 0) {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(img, f.sx, f.sy, f.w, f.h, f.dx, f.dy, f.w, f.h)
            if (shown < 0 || FILM.frames[shown]!.s !== f.s) void ready(f.s + 1)
            shown = k
          }
        }
        if (route.playState !== 'finished') requestAnimationFrame(draw)
      }
      requestAnimationFrame(draw)

      // As he passes each fresh grave, its crow leaves and frost takes the stone.
      const graves = [...stage.querySelectorAll<HTMLElement>('[data-grave]')]
      const passed = new Set<HTMLElement>()
      const pass = (g: HTMLElement) => {
        passed.add(g)
        g.setAttribute('data-frost', '')
        const crow = g.querySelector('.funeral-crow')
        if (!crow) return
        play(
          crow,
          [
            { transform: 'none', opacity: 1 },
            { transform: 'translate(25%, -45%) rotate(-10deg)', opacity: 1, offset: 0.3 },
            { transform: 'translate(190%, -330%) rotate(-18deg)', opacity: 0 },
          ],
          { duration: 1500, easing: 'cubic-bezier(0.4, 0, 0.7, 1)' },
        )
        const wing = crow.querySelector('.crow-wing')
        if (wing) {
          play(wing, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-28deg)' }], {
            duration: 160,
            iterations: 9,
            direction: 'alternate',
          })
        }
      }
      const watch = () => {
        if (cancelled) return
        const x = me.getBoundingClientRect().left + FILM.originX * plan.scale
        for (const g of graves) {
          const b = g.getBoundingClientRect()
          if (!passed.has(g) && x >= b.left + b.width / 2) pass(g)
        }
        if (route.playState !== 'finished') requestAnimationFrame(watch)
      }
      requestAnimationFrame(watch)
      if (!(await done(route))) return
      // Gone past them all: every crow gone, every stone frosted.
      graves.filter((g) => !passed.has(g)).forEach(pass)

      // And with him out of sight, the world comes back.
      play(me, [{ opacity: 0 }, { opacity: 0 }], { duration: 1 })
      doc.documentElement.classList.remove('death-is-here')
      drops.forEach((a) => a.play())
      play(world, [{ opacity: 1 }, { opacity: 0 }], { duration: RETURN, easing: 'ease-out' })
      if (!(await done(play(rain, [{ opacity: 1 }, { opacity: 0 }], { duration: RETURN })))) return
      if (!cancelled) setPhase('gone')
    })()
    return () => {
      cancelled = true
      doc.documentElement.classList.remove('death-is-here')
      running.forEach((a) => a.cancel())
    }
  }, [off, ids, basePath])

  return (
    <>
      <span ref={marker} hidden />
      {!off &&
        phase !== 'gone' &&
        typeof document !== 'undefined' &&
        createPortal(
          <div ref={scene} aria-hidden="true" className="death-scene" data-death={phase}>
            <div className="death-world" />
            <div className="death-rain">
              {RAIN.map((d, i) => (
                <span
                  key={i}
                  style={
                    {
                      left: d.left,
                      height: `${d.length}px`,
                      opacity: d.opacity,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
            <div className="death-figure">
              {/* seen against a cold light behind him, the mist at his feet */}
              <div className="death-halo" />
              <div className="death-mist" />
              <canvas className="death-sprite" data-sheets={FILM.sheets.join(' ')} />
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

/** Resolves with the stone once its funeral is over; null if it will never play. */
function finished(stage: HTMLElement, id: string, cancelled: () => boolean) {
  return new Promise<HTMLElement | null>((resolve) => {
    const watch = new MutationObserver(() => check())
    const settle = (v: HTMLElement | null) => {
      watch.disconnect()
      resolve(v)
    }
    const check = () => {
      if (cancelled()) return settle(null)
      const stone = stage.querySelector<HTMLElement>(`[data-grave="${CSS.escape(id)}"]`)
      if (stone?.dataset.funeral === 'done') return settle(stone)
      if (stone?.dataset.funeral === 'skipped') return settle(null)
    }
    watch.observe(stage, { subtree: true, attributes: true, attributeFilter: ['data-funeral'] })
    check()
  })
}

/** Resolves once the graves are on screen: he does not come for an empty room. */
function inView(stage: HTMLElement, cancelled: () => boolean) {
  return new Promise<boolean>((resolve) => {
    if (typeof IntersectionObserver === 'undefined') return resolve(true)
    const watch = new IntersectionObserver(
      (entries) => {
        if (cancelled()) {
          watch.disconnect()
          return resolve(false)
        }
        if (entries.some((e) => e.isIntersecting)) {
          watch.disconnect()
          resolve(true)
        }
      },
      { threshold: 0.15 },
    )
    watch.observe(stage)
  })
}
