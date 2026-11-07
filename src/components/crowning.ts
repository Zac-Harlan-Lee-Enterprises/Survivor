/**
 * The crowning: what the page does for the last one standing.
 *
 * The page falls into a warm dark that leaves the winner in a pool of light.
 * A shaft of light comes down onto them, dust turning slowly in it. A gold
 * ring draws itself round each winner's headshot and a glint runs once round
 * it. Gold leaf drifts down, turning over and catching the light as it falls.
 * Then the lights come up, the confetti goes off (the finale), and the ring
 * stays.
 *
 * Plain DOM and the Web Animations API, laid over the page and pointed at the
 * winner's headshots wherever they are on screen. Without `Element.animate`
 * (old browsers, tests) it skips straight to the finale and the ring.
 */

const DIM = 1000
const BEAM = 1400
const RING = 1500
const HOLD = 4400
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

/** Plays the crowning over `section`; `finale` fires as the lights come up. Returns a cancel. */
export function crown(section: Element, finale: () => void): () => void {
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
    })
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
      if (t > lightsUp + LIFT && falling === 0) return finish()
      if (t > lightsUp + LIFT * 3) return finish()
    }
    frame = win.requestAnimationFrame(tick)
  }
  win.addEventListener('resize', size)
  frame = win.requestAnimationFrame(tick)

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

  // Lights up: the finale, and the ring passed to the headshot for good.
  const lift = win.setTimeout(() => {
    if (cancelled) return
    lightsUp = performance.now() - start
    const out = { duration: LIFT, easing: 'ease-out' }
    play(dark, [{ opacity: 1 }, { opacity: 0 }], out)
    play(beam, [{ opacity: 1 }, { opacity: 0 }], out)
    rings.forEach((r) => play(r.el, [{ opacity: 1 }, { opacity: 0 }], out))
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
  return () => {
    if (!cancelled) cleanup()
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
