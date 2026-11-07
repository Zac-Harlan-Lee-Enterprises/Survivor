/**
 * The crowning: what the page does for the last one standing.
 *
 * The page falls into a warm dark that leaves the winner in a pool of light.
 * A shaft of light comes down onto them, dust turning slowly in it. A gold
 * ring draws itself round each winner's headshot and a glint runs once round
 * it. Gold leaf drifts down, turning over and catching the light as it falls.
 * While it does, the logo of every team they picked comes in, week by week,
 * and settles into a laurel round them: two branches climbing from the
 * bottom, the first weeks at the stem and the last at the tips, the lost
 * weeks in grey. Then the lights come up, the confetti goes off (the
 * finale), and the ring stays.
 *
 * Plain DOM and the Web Animations API, laid over the page and pointed at the
 * winner's headshots wherever they are on screen. Without `Element.animate`
 * (old browsers, tests) it skips straight to the finale and the ring.
 *
 * A fanfare (music.ts) comes in with the light, timed so its swell meets the
 * confetti, and plays on, looping, after the scene is over, until the page
 * is left or it is silenced.
 */

import type { Cue } from './music'

const DIM = 1000
const BEAM = 1400
const RING = 1500
const HOLD = 6800
/** The wreath: when the first logo sets off, the gap between them, and each one's flight. */
const WREATH_AT = DIM + 600
const WREATH_STEP = 140
const WREATH_FLIGHT = 1100
/** The trophy: when it starts to rise, and how long it takes. */
const TROPHY_AT = DIM + 1500
const TROPHY_RISE = 1900
/** It turns once as it rises (this fast), and stops facing you. */
const TROPHY_FPS = 15
/** Then the name is engraved, left to right. */
const ENGRAVE = 900
/** After the lights come up it stays a while, then goes. */
const TROPHY_STAYS = 2600
const TROPHY_GOES = 1400
/** How far into the fanfare its swell comes (ms): it is started so the swell meets the confetti. */
const SWELL = 5400
const LIFT = 1600
const LEAF_FOR = 3200

const GOLD = ['#fde68a', '#fbbf24', '#f59e0b', '#d97706']

type Flake = {
  x: number
  y: number
  size: number
  shape: [number, number][]
  rot: number
  spin: number
  flip: number
  flipRate: number
  fall: number
  sway: number
  swayRate: number
  born: number
  hue: string
}

type Mote = { x: number; y: number; r: number; rise: number; twinkle: number }

/** One week's pick in a winner's wreath: the team's logo, and whether it won. */
export interface Laurel {
  src: string
  won: boolean
}

/** The trophy's turn, rendered by scripts/art/trophy_scene.py: one sheet of frames. */
export interface TrophyFilm {
  sheet: string
  frames: number
  cols: number
  frameWidth: number
  frameHeight: number
  fps: number
  /** The plaque's blank line at frame 0, as fractions of a frame: where the name goes. */
  nameBox?: { x: number; y: number; w: number; h: number }
}

export interface Staging {
  /** Music from the moment the light comes down. */
  fanfare?: Cue
  /** Each winner's picks in week order, in the same order as their headshots. */
  wreaths?: Laurel[][]
  /** The trophy that rises into the light, turning: its film, where its sheet is, and whose name it takes. */
  trophy?: { film: TrophyFilm; src: string; name?: string }
}

/** Plays the crowning over `section`; `finale` fires as the lights come up. Returns a cancel. */
export function crown(
  section: Element,
  finale: () => void,
  { fanfare, wreaths = [], trophy }: Staging = {},
): () => void {
  const doc = section.ownerDocument
  const faces = [...section.querySelectorAll<HTMLElement>('img.rounded-full')]
  const marks = faces.length ? faces : [section as HTMLElement]
  const settle = () => marks.forEach((f) => f.setAttribute('data-crowned', ''))

  if (typeof section.animate !== 'function' || !doc.defaultView) {
    finale()
    settle()
    return () => {}
  }
  const win = doc.defaultView
  let cancelled = false
  const running: Animation[] = []
  const play = (el: Element, frames: Keyframe[], opts: KeyframeAnimationOptions) => {
    const a = el.animate(frames, { fill: 'forwards', ...opts })
    running.push(a)
    return a
  }

  // The stage, laid over everything and never in the way of a click.
  const root = doc.createElement('div')
  root.className = 'crowning'
  root.setAttribute('aria-hidden', 'true')
  const dark = doc.createElement('div')
  dark.className = 'crowning-dark'
  const beam = doc.createElement('div')
  beam.className = 'crowning-beam'
  const canvas = doc.createElement('canvas')
  canvas.className = 'crowning-leaf'
  root.append(dark, beam, canvas)
  const rings = marks.map(() => ring(doc))
  rings.forEach((r) => root.append(r.el))
  // (Only when there is a wreath for every face: never one on the wrong person.)
  const laurels = faces.length && wreaths.length === faces.length ? wreaths : []
  const wreathed = laurels.map((w) => w.map((l) => laurel(doc, l)))
  wreathed.forEach((w) => w.forEach((l) => root.append(l.el)))
  const cup = trophy ? stand(doc, trophy) : null
  if (cup) root.append(cup.el)
  doc.body.append(root)

  // Where the winners are, read every frame so a scroll never loses them.
  const place = () => {
    const boxes = marks.map((m) => m.getBoundingClientRect())
    const left = Math.min(...boxes.map((b) => b.left))
    const right = Math.max(...boxes.map((b) => b.right))
    const top = Math.min(...boxes.map((b) => b.top))
    const bottom = Math.max(...boxes.map((b) => b.bottom))
    const cx = (left + right) / 2
    const cy = (top + bottom) / 2
    const radius = Math.max(right - left, bottom - top) / 2 + 48
    root.style.setProperty('--cx', `${cx}px`)
    root.style.setProperty('--cy', `${cy}px`)
    root.style.setProperty('--r', `${radius}px`)
    beam.style.left = `${cx - radius * 1.3}px`
    beam.style.width = `${radius * 2.6}px`
    beam.style.height = `${Math.max(cy + radius * 0.4, 0)}px`
    boxes.forEach((b, i) => {
      const r = rings[i]!.el
      const pad = 10
      r.style.left = `${b.left - pad}px`
      r.style.top = `${b.top - pad}px`
      r.style.width = `${b.width + pad * 2}px`
      r.style.height = `${b.height + pad * 2}px`
      const leaves = wreathed[i]
      if (!leaves?.length) return
      const spots = wreathSpots(leaves.length, b.width / 2 + pad)
      leaves.forEach((l, k) => {
        const spot = spots[k]!
        l.el.style.left = `${b.left + b.width / 2 + spot.x - spot.size / 2}px`
        l.el.style.top = `${b.top + b.height / 2 + spot.y - spot.size / 2}px`
        l.el.style.width = l.el.style.height = `${spot.size}px`
        l.el.style.padding = `${spot.size * 0.14}px`
      })
    })
    if (cup) cup.place({ left, right, top, bottom }, win.innerWidth, win.innerHeight)
    return { cx, cy, radius, top }
  }

  // Leaf and dust, drawn on one canvas the size of the window.
  const ctx = canvas.getContext('2d')
  const dpr = Math.min(win.devicePixelRatio || 1, 2)
  const size = () => {
    canvas.width = win.innerWidth * dpr
    canvas.height = win.innerHeight * dpr
  }
  size()
  const rand = (a: number, b: number) => a + Math.random() * (b - a)
  const flakes: Flake[] = Array.from(
    { length: Math.round(Math.min(win.innerWidth, 1400) / 11) },
    () => {
      const s = rand(7, 16)
      // A torn scrap of leaf: an irregular four or five sided piece.
      const n = Math.random() < 0.5 ? 4 : 5
      const shape = Array.from({ length: n }, (_, k) => {
        const a = (k / n) * Math.PI * 2 + rand(-0.35, 0.35)
        const d = rand(0.55, 1)
        return [Math.cos(a) * d, Math.sin(a) * d * rand(0.6, 1)] as [number, number]
      })
      return {
        x: rand(-0.05, 1.05) * win.innerWidth,
        y: rand(-0.2, -0.02) * win.innerHeight,
        size: s,
        shape,
        rot: rand(0, Math.PI * 2),
        spin: rand(-0.9, 0.9),
        flip: rand(0, Math.PI * 2),
        flipRate: rand(1.6, 3.6),
        fall: rand(55, 95),
        sway: rand(14, 42),
        swayRate: rand(0.5, 1.2),
        born: rand(0, LEAF_FOR - 900),
        hue: GOLD[Math.floor(Math.random() * GOLD.length)]!,
      }
    },
  )
  const motes: Mote[] = Array.from({ length: 46 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: rand(0.6, 1.8),
    rise: rand(0.012, 0.035),
    twinkle: rand(0, Math.PI * 2),
  }))

  const start = performance.now()
  let last = start
  let lightsUp = Infinity
  let frame = 0
  const tick = (now: number) => {
    if (cancelled) return
    const t = now - start
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    const { cx, cy, radius } = place()
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, win.innerWidth, win.innerHeight)
      const fade = t < lightsUp ? 1 : Math.max(0, 1 - (t - lightsUp) / LIFT)

      // Dust in the shaft of light, rising, catching it now and then.
      const shaft = Math.min(1, Math.max(0, (t - DIM * 0.6) / BEAM)) * fade
      if (shaft > 0) {
        for (const m of motes) {
          m.y -= m.rise * dt
          if (m.y < 0) m.y += 1
          m.twinkle += dt * 1.7
          const depth = m.y // 0 at the top of the shaft, 1 at the winner
          const spread = radius * (0.5 + 0.8 * depth)
          const x = cx + (m.x - 0.5) * 2 * spread
          const y = depth * (cy + radius * 0.2)
          const a = shaft * (0.25 + 0.55 * Math.max(0, Math.sin(m.twinkle))) * (0.4 + 0.6 * depth)
          ctx.fillStyle = `rgba(255, 232, 170, ${a.toFixed(3)})`
          ctx.beginPath()
          ctx.arc(x, y, m.r, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Gold leaf, turning over as it falls: bright when it faces the light.
      let falling = 0
      for (const f of flakes) {
        if (t < DIM + f.born) {
          falling++
          continue
        }
        f.y += f.fall * dt
        f.rot += f.spin * dt
        f.flip += f.flipRate * dt
        if (f.y > win.innerHeight + 30) continue
        falling++
        const face = Math.cos(f.flip)
        const lit = Math.abs(face)
        const x = f.x + Math.sin((t / 1000) * f.swayRate + f.born) * f.sway
        ctx.save()
        ctx.translate(x, f.y)
        ctx.rotate(f.rot)
        ctx.scale(1, Math.max(0.08, lit))
        ctx.globalAlpha = fade * (0.6 + 0.4 * lit)
        // Metal, not paper: shaded across the face, darker as it turns away,
        // and only a flash of white when it squarely catches the light.
        const sheen = ctx.createLinearGradient(-f.size, -f.size, f.size, f.size)
        sheen.addColorStop(0, lit > 0.985 ? '#fffbeb' : '#fde68a')
        sheen.addColorStop(0.5, f.hue)
        sheen.addColorStop(1, lit > 0.6 ? '#b45309' : '#78350f')
        ctx.fillStyle = sheen
        ctx.beginPath()
        f.shape.forEach(([px, py], k) =>
          k ? ctx.lineTo(px * f.size, py * f.size) : ctx.moveTo(px * f.size, py * f.size),
        )
        ctx.closePath()
        ctx.fill()
        // The darker underside shows as a thin edge while it turns.
        if (lit < 0.5) {
          ctx.globalAlpha *= 0.6
          ctx.strokeStyle = '#92400e'
          ctx.lineWidth = 0.8
          ctx.stroke()
        }
        ctx.restore()
      }
      cup?.draw(t - TROPHY_AT)
      const trophyGone = !cup || t > lightsUp + TROPHY_STAYS + TROPHY_GOES
      if (t > lightsUp + LIFT && falling === 0 && trophyGone) return finish()
      if (t > lightsUp + LIFT * 3) return finish()
    }
    frame = win.requestAnimationFrame(tick)
  }
  win.addEventListener('resize', size)
  frame = win.requestAnimationFrame(tick)
  const music = win.setTimeout(() => fanfare?.start(), Math.max(0, DIM + HOLD - SWELL))

  // The light: the room goes down, the shaft comes on, the rings are drawn.
  play(dark, [{ opacity: 0 }, { opacity: 1 }], { duration: DIM, easing: 'ease-in-out' })
  play(
    beam,
    [
      { opacity: 0, transform: 'scaleY(0.2)' },
      { opacity: 1, transform: 'scaleY(1)' },
    ],
    { duration: BEAM, delay: DIM * 0.6, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' },
  )
  rings.forEach((r, i) => {
    play(r.stroke, [{ strokeDashoffset: r.length }, { strokeDashoffset: 0 }], {
      duration: RING,
      delay: DIM + 300 + i * 220,
      easing: 'cubic-bezier(0.6, 0, 0.2, 1)',
    })
    play(
      r.glint,
      [
        { transform: 'rotate(-90deg)', opacity: 0 },
        { opacity: 1, offset: 0.15 },
        { opacity: 1, offset: 0.85 },
        { transform: 'rotate(270deg)', opacity: 0 },
      ],
      { duration: 1300, delay: DIM + 300 + RING + i * 220, easing: 'ease-in-out' },
    )
  })

  // The wreath: each week's logo comes in from further out, one after the
  // other, and settles in its place on the laurel.
  wreathed.forEach((leaves, i) => {
    const spots = wreathSpots(leaves.length, 100)
    leaves.forEach((l, k) => {
      const away = Math.atan2(spots[k]!.y, spots[k]!.x) + rand(-0.5, 0.5)
      const far = rand(70, 130)
      play(
        l.el,
        [
          {
            opacity: 0,
            transform: `translate(${Math.cos(away) * far}px, ${Math.sin(away) * far}px) scale(0.5) rotate(${rand(-40, 40)}deg)`,
          },
          { opacity: 1, offset: 0.35 },
          { opacity: 1, transform: 'translate(0, 0) scale(1) rotate(0deg)' },
        ],
        {
          duration: WREATH_FLIGHT,
          delay: WREATH_AT + i * 200 + k * WREATH_STEP,
          easing: 'cubic-bezier(0.2, 0.8, 0.25, 1)',
        },
      )
    })
  })

  // The trophy comes up out of the dark into the light, turning.
  if (cup)
    play(
      cup.el,
      [
        { opacity: 0, transform: 'translateY(45%) scale(0.92)' },
        { opacity: 1, offset: 0.4 },
        { opacity: 1, transform: 'translateY(0) scale(1)' },
      ],
      { duration: TROPHY_RISE, delay: TROPHY_AT, easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)' },
    )
  // Facing you now: the winner's name engraved on the plaque.
  if (cup?.name)
    play(
      cup.name,
      [
        { clipPath: 'inset(0 100% 0 0)', opacity: 0.6 },
        { clipPath: 'inset(0 0 0 0)', opacity: 1 },
      ],
      {
        duration: ENGRAVE,
        delay: TROPHY_AT + cup.turnMs + 150,
        easing: 'cubic-bezier(0.45, 0, 0.55, 1)',
      },
    )

  // Lights up: the finale, and the ring passed to the headshot for good.
  const lift = win.setTimeout(() => {
    if (cancelled) return
    lightsUp = performance.now() - start
    const out = { duration: LIFT, easing: 'ease-out' }
    play(dark, [{ opacity: 1 }, { opacity: 0 }], out)
    play(beam, [{ opacity: 1 }, { opacity: 0 }], out)
    rings.forEach((r) => play(r.el, [{ opacity: 1 }, { opacity: 0 }], out))
    wreathed.flat().forEach((l) => play(l.el, [{ opacity: 1 }, { opacity: 0 }], out))
    if (cup)
      play(cup.el, [{ opacity: 1 }, { opacity: 0 }], {
        duration: TROPHY_GOES,
        delay: TROPHY_STAYS,
        easing: 'ease-in',
      })
    settle()
    finale()
  }, DIM + HOLD)

  function finish() {
    if (cancelled) return
    cleanup()
  }
  function cleanup() {
    cancelled = true
    win.cancelAnimationFrame(frame)
    win.clearTimeout(lift)
    win.removeEventListener('resize', size)
    running.forEach((a) => a.cancel())
    root.remove()
  }
  // Over, the stage is cleared but the fanfare plays on; leaving stops it.
  return () => {
    if (!cancelled) cleanup()
    win.clearTimeout(music)
    fanfare?.stop(1200)
  }
}

/** A gold ring for one headshot: the stroke that draws itself, and its glint. */
function ring(doc: Document) {
  const NS = 'http://www.w3.org/2000/svg'
  const el = doc.createElement('div')
  el.className = 'crowning-ring'
  const svg = doc.createElementNS(NS, 'svg')
  svg.setAttribute('viewBox', '0 0 100 100')
  const id = `crown-${Math.random().toString(36).slice(2, 8)}`
  svg.innerHTML = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fef3c7"/><stop offset="0.35" stop-color="#fbbf24"/>
      <stop offset="0.65" stop-color="#b45309"/><stop offset="1" stop-color="#fde68a"/>
    </linearGradient></defs>`
  const length = 2 * Math.PI * 47
  const stroke = doc.createElementNS(NS, 'circle')
  stroke.setAttribute('cx', '50')
  stroke.setAttribute('cy', '50')
  stroke.setAttribute('r', '47')
  stroke.setAttribute('fill', 'none')
  stroke.setAttribute('stroke', `url(#${id})`)
  stroke.setAttribute('stroke-width', '2.4')
  stroke.setAttribute('stroke-linecap', 'round')
  stroke.setAttribute('stroke-dasharray', `${length}`)
  stroke.setAttribute('stroke-dashoffset', `${length}`)
  stroke.setAttribute('transform', 'rotate(-90 50 50)')
  svg.append(stroke)
  const glint = doc.createElement('div')
  glint.className = 'crowning-glint'
  el.append(svg, glint)
  return { el, stroke, glint, length }
}

/**
 * Where each logo sits in a wreath of `n` round a headshot of radius `r`,
 * relative to its centre: alternately on the left and right branch, climbing
 * from the stem at the bottom to the tips near the top, a little smaller
 * towards the tips, as leaves are.
 */
export function wreathSpots(n: number, r: number) {
  const perSide = Math.max(1, Math.ceil(n / 2))
  const BOTTOM = (30 * Math.PI) / 180 // the gap at the stem
  const TOP = (34 * Math.PI) / 180 // the gap between the tips
  const arc = Math.PI - BOTTOM - TOP
  const radius0 = r + Math.min(Math.max(r * 0.34, 20), 38)
  const room = (radius0 * arc) / perSide
  const base = Math.min(Math.max(room * 0.86, 18), 40)
  return Array.from({ length: n }, (_, k) => {
    const side = k % 2 === 0 ? -1 : 1
    const step = Math.floor(k / 2)
    const along = perSide === 1 ? 0.5 : step / (perSide - 1)
    // Angle from straight up, clockwise: the stem is at π.
    const theta = Math.PI - BOTTOM / 2 - along * arc
    const size = base * (1 - 0.22 * along)
    const radius = radius0 + base * 0.5 - size * 0.5
    return {
      x: side * Math.sin(theta) * radius,
      y: -Math.cos(theta) * radius,
      size,
    }
  })
}

/** One logo in a wreath, on its own small gold-rimmed medallion; placed each frame. */
function laurel(doc: Document, { src, won }: Laurel) {
  const el = doc.createElement('div')
  el.className = won ? 'crowning-laurel' : 'crowning-laurel crowning-laurel-lost'
  const logo = doc.createElement('img')
  logo.src = src
  logo.alt = ''
  logo.decoding = 'async'
  el.append(logo)
  el.style.opacity = '0'
  return { el }
}

type Box = { left: number; right: number; top: number; bottom: number }

type Footing = 'right' | 'left' | 'below'

/** Room left at the foot of a phone's screen for its tab bar (px). */
const FOOT = 104

/**
 * Where the trophy stands, for winners in `box` on a `vw` × `vh` screen: beside
 * them, on whichever side has the room, standing a little below their
 * eyeline; or, on a narrow screen, below them at the foot of the screen.
 * `keep` holds it to the footing it was first given, so it never changes
 * sides mid-scene, only follows a scroll.
 */
export function trophySpot(box: Box, vw: number, vh: number, aspect: number, keep?: Footing) {
  const height = Math.min(Math.max(vh * 0.3, 150), 300)
  const width = height * aspect
  const gap = Math.max(width * 0.9, 130)
  const roomRight = vw - box.right
  const roomLeft = box.left
  const fits = (room: number) => room >= width + gap + 16
  const footing: Footing =
    keep ??
    (fits(Math.max(roomRight, roomLeft)) ? (roomRight >= roomLeft ? 'right' : 'left') : 'below')
  if (footing !== 'below') {
    const cx = footing === 'right' ? box.right + gap + width / 2 : box.left - gap - width / 2
    const cy = (box.top + box.bottom) / 2
    const top = Math.min(Math.max(cy - height * 0.45, 8), vh - height - 8)
    return { footing, left: cx - width / 2, top, width, height }
  }
  // Below: bigger, so the plaque can be read, and stood clear of the
  // phone's tab bar so the plaque is not behind it.
  const tall = Math.min(Math.max(vh * 0.36, 150), 320)
  const wide = tall * aspect
  const cx = (box.left + box.right) / 2
  const top = Math.max(box.bottom + 24, vh - tall - FOOT)
  const left = Math.min(Math.max(cx - wide / 2, 8), vw - wide - 8)
  return { footing, left, top, width: wide, height: tall }
}

/** The trophy on the stage: a glow behind, and a canvas its turn is drawn on. */
function stand(
  doc: Document,
  { film, src, name }: { film: TrophyFilm; src: string; name?: string },
) {
  const el = doc.createElement('div')
  el.className = 'crowning-trophy'
  el.style.opacity = '0'
  const glow = doc.createElement('div')
  glow.className = 'crowning-trophy-glow'
  const canvas = doc.createElement('canvas')
  canvas.width = film.frameWidth
  canvas.height = film.frameHeight
  el.append(glow, canvas)
  // The name, laid on the plaque's blank line in the engraving's own type.
  const line = film.nameBox
  const plate = name && line ? doc.createElement('div') : null
  if (plate && line) {
    plate.className = 'crowning-trophy-name'
    plate.textContent = name!
    plate.style.left = `${line.x * 100}%`
    plate.style.top = `${line.y * 100}%`
    plate.style.width = `${line.w * 100}%`
    plate.style.height = `${line.h * 100}%`
    plate.style.clipPath = 'inset(0 100% 0 0)'
    el.append(plate)
  }
  const ctx = canvas.getContext('2d')
  const sheet = new Image()
  sheet.decoding = 'async'
  sheet.src = src
  let shown = -1
  let footing: Footing | undefined
  return {
    el,
    name: plate,
    /** One full turn, ending with the plaque to the front. */
    turnMs: (film.frames / TROPHY_FPS) * 1000,
    place(box: Box, vw: number, vh: number) {
      const spot = trophySpot(box, vw, vh, film.frameWidth / film.frameHeight, footing)
      footing = spot.footing
      el.style.left = `${spot.left}px`
      el.style.top = `${spot.top}px`
      el.style.width = `${spot.width}px`
      el.style.height = `${spot.height}px`
      if (plate && line)
        plate.style.fontSize = `${engraving(name!, spot.width * line.w, spot.height * line.h)}px`
    },
    draw(ms: number) {
      if (!ctx || ms < 0 || !sheet.complete || sheet.naturalWidth === 0) return
      // Once round, then still, facing you.
      const k =
        ms >= (film.frames / TROPHY_FPS) * 1000
          ? 0
          : Math.floor((ms / 1000) * TROPHY_FPS) % film.frames
      if (k === shown) return
      shown = k
      const sx = (k % film.cols) * film.frameWidth
      const sy = Math.floor(k / film.cols) * film.frameHeight
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(
        sheet,
        sx,
        sy,
        film.frameWidth,
        film.frameHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      )
    },
  }
}

/** The type size that fits `name` on a line `w` × `h` px: the line's height, or less for a long name. */
export function engraving(name: string, w: number, h: number) {
  // (Bold italic serif capitals and lower case run about half an em wide.)
  return Math.max(4, Math.min(h * 0.95, w / Math.max(1, name.length * 0.5)))
}
