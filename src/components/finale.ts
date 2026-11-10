/**
 * The finale's two encores, after the lights come up (useConfetti.ts plays
 * them with the confetti):
 *
 * - Camera flashes: photographers at the presentation, popping round the
 *   room. Small, and never more than three in any second, so they stay well
 *   inside the guidance on flashing light (WCAG 2.3.1).
 * - Gold fireworks: a few slow shells opening high in the dark, their sparks
 *   drifting down past the winner. Sparse on purpose: an encore, not a show.
 *
 * Each lays its own layer over the page, clears it away when done, and
 * returns a cancel for when the page is left first.
 */

const rand = (a: number, b: number) => a + Math.random() * (b - a)

/** The gap between flashes (ms): above a third of a second, so at most three a second. */
export const FLASH_GAP = 340

/** When each flash goes off (ms from now): `count` of them, never closer than FLASH_GAP. */
export function flashTimes(count: number, span: number) {
  const slack = Math.max(0, span - FLASH_GAP * (count - 1))
  const cuts = Array.from({ length: count }, () => Math.random() * slack).sort((a, b) => a - b)
  return cuts.map((c, i) => Math.round(c + i * FLASH_GAP))
}

export function flashes(doc: Document, { count = 9, span = 3200 } = {}): () => void {
  const win = doc.defaultView
  if (!win || typeof doc.body.animate !== 'function') return () => {}
  const layer = doc.createElement('div')
  layer.className = 'camera-flashes'
  layer.setAttribute('aria-hidden', 'true')
  doc.body.append(layer)
  const timers = flashTimes(count, span).map((at) =>
    win.setTimeout(() => {
      const flash = doc.createElement('div')
      flash.className = 'camera-flash'
      // From the crowd: round the sides and along the bottom of the screen.
      const edge = Math.random()
      const x = edge < 0.35 ? rand(0.02, 0.18) : edge < 0.7 ? rand(0.82, 0.98) : rand(0.1, 0.9)
      const y = edge < 0.7 ? rand(0.25, 0.95) : rand(0.78, 0.97)
      const size = rand(70, 130)
      flash.style.left = `${x * win.innerWidth - size / 2}px`
      flash.style.top = `${y * win.innerHeight - size / 2}px`
      flash.style.width = flash.style.height = `${size}px`
      layer.append(flash)
      const pop = flash.animate(
        [
          { opacity: 0, transform: 'scale(0.4) rotate(0deg)' },
          { opacity: 1, transform: 'scale(1) rotate(10deg)', offset: 0.12 },
          { opacity: 0, transform: 'scale(0.85) rotate(20deg)' },
        ],
        { duration: 420, easing: 'ease-out' },
      )
      pop.onfinish = () => flash.remove()
    }, at),
  )
  const done = win.setTimeout(() => layer.remove(), span + 800)
  return () => {
    timers.forEach((t) => win.clearTimeout(t))
    win.clearTimeout(done)
    layer.remove()
  }
}

type Spark = {
  x: number
  y: number
  vx: number
  vy: number
  trail: [number, number][]
  life: number
  age: number
  drag: number
  hue: string
}
type Shell = {
  at: number
  x: number
  y: number
  fromY: number
  rise: number
  kind: 'peony' | 'willow'
  burst: boolean
}

const SPARK_GOLD = ['#fff7e0', '#fde68a', '#fbbf24', '#fcd34d']
const WILLOW_GOLD = ['#fbbf24', '#f59e0b', '#fde68a']

export function fireworks(doc: Document, { shells = 6, gap = 700 } = {}): () => void {
  const win = doc.defaultView
  if (!win) return () => {}
  const canvas = doc.createElement('canvas')
  canvas.className = 'fireworks'
  canvas.setAttribute('aria-hidden', 'true')
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}
  const sky = doc.createElement('div')
  sky.className = 'fireworks-sky'
  sky.setAttribute('aria-hidden', 'true')
  doc.body.append(sky, canvas)
  const dusk = (to: number, ms: number) =>
    typeof sky.animate === 'function'
      ? sky.animate([{ opacity: 1 - to }, { opacity: to }], { duration: ms, fill: 'forwards' })
      : null
  dusk(1, 700)
  let dawning = false
  const dpr = Math.min(win.devicePixelRatio || 1, 2)
  const size = () => {
    canvas.width = win.innerWidth * dpr
    canvas.height = win.innerHeight * dpr
  }
  size()
  win.addEventListener('resize', size)

  // High in the dark, spread across the width, the last two the slow willows.
  const vw = () => win.innerWidth
  const vh = () => win.innerHeight
  const plan: Shell[] = Array.from({ length: shells }, (_, i) => {
    const lane = (i % 3) / 3 + rand(0.06, 0.27)
    return {
      at: i * gap + rand(-120, 120),
      x: lane,
      y: rand(0.12, 0.3),
      fromY: 1.02,
      rise: rand(850, 1050),
      kind: i >= shells - 2 ? 'willow' : 'peony',
      burst: false,
    }
  })
  const sparks: Spark[] = []
  const blooms: { x: number; y: number; at: number }[] = []
  const burst = (s: Shell) => {
    blooms.push({ x: s.x * vw(), y: s.y * vh(), at: performance.now() })
    const n = s.kind === 'willow' ? 70 : 90
    const speed = Math.max(Math.min(vw(), 1000), 420) * (s.kind === 'willow' ? 0.3 : 0.38)
    const palette = s.kind === 'willow' ? WILLOW_GOLD : SPARK_GOLD
    for (let k = 0; k < n; k++) {
      // A sphere of sparks seen from the front: full, not a flat ring.
      const a = rand(0, Math.PI * 2)
      const v = speed * Math.sqrt(1 - Math.pow(rand(-1, 1), 2)) * rand(0.92, 1.05)
      const x = s.x * vw()
      const y = s.y * vh()
      sparks.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        trail: [],
        life: s.kind === 'willow' ? rand(2600, 3400) : rand(1500, 2200),
        age: 0,
        drag: s.kind === 'willow' ? 1.6 : 2.2,
        hue: palette[k % palette.length]!,
      })
    }
  }

  const start = performance.now()
  let last = start
  let frame = 0
  let over = false
  const end = () => {
    over = true
    win.cancelAnimationFrame(frame)
    win.removeEventListener('resize', size)
    canvas.remove()
    sky.remove()
  }
  const tick = (now: number) => {
    if (over) return
    const t = now - start
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, vw(), vh())
    ctx.globalCompositeOperation = 'lighter'

    // Shells climbing, a faint spark with a short tail.
    for (const s of plan) {
      if (s.burst || t < s.at) continue
      const u = Math.min(1, (t - s.at) / s.rise)
      if (u >= 1) {
        s.burst = true
        burst(s)
        continue
      }
      const ease = 1 - (1 - u) * (1 - u)
      const x = s.x * vw()
      const y = (s.fromY + (s.y - s.fromY) * ease) * vh()
      const tail = ctx.createLinearGradient(x, y, x, y + 46)
      tail.addColorStop(0, 'rgba(255, 236, 180, 0.9)')
      tail.addColorStop(1, 'rgba(255, 236, 180, 0)')
      ctx.strokeStyle = tail
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x, y + 46)
      ctx.stroke()
    }

    // The instant it opens: a soft flare where the shell was.
    for (const b of blooms) {
      const u = (now - b.at) / 260
      if (u > 1) continue
      const r = 26 + 40 * u
      const glow = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r)
      glow.addColorStop(0, `rgba(255, 244, 214, ${(0.75 * (1 - u)).toFixed(3)})`)
      glow.addColorStop(1, 'rgba(255, 220, 140, 0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2)
      ctx.fill()
    }

    // Sparks: slowing, falling, trailing, and twinkling out at the end.
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i]!
      p.age += dt * 1000
      if (p.age > p.life) {
        sparks.splice(i, 1)
        continue
      }
      const slow = Math.exp(-p.drag * dt)
      p.vx *= slow
      p.vy = p.vy * slow + 46 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.trail.push([p.x, p.y])
      if (p.trail.length > 4) p.trail.shift()
      const left = 1 - p.age / p.life
      const twinkle = left < 0.3 ? (Math.random() < 0.5 ? 0.25 : 1) : 1
      const alpha = Math.min(1, left * 1.6) * twinkle
      ctx.globalAlpha = alpha * 0.55
      ctx.strokeStyle = p.hue
      ctx.lineWidth = 1.4
      ctx.beginPath()
      p.trail.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      ctx.stroke()
      ctx.globalAlpha = alpha
      ctx.fillStyle = p.hue
      ctx.beginPath()
      ctx.arc(p.x, p.y, 1.7, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    // The night lifts as the last sparks go out.
    if (!dawning && plan.every((s) => s.burst) && sparks.length < 40) {
      dawning = true
      dusk(0, 1400)
    }
    if (plan.every((s) => s.burst) && sparks.length === 0) return end()
    frame = win.requestAnimationFrame(tick)
  }
  frame = win.requestAnimationFrame(tick)
  return () => {
    if (!over) end()
  }
}
