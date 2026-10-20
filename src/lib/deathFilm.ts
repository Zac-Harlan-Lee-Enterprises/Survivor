/**
 * Death's film (rendered by scripts/art/death_scene.py, packed by
 * scripts/art/death_film.py into src/components/deathFrames.json and the
 * sheets under public/death/): which frame to show when, and where he is on
 * the page, so his feet stay where they land.
 *
 * He walks in from off the left of the screen in whole strides (the stride
 * loops), then the scene plays once: one last step, a stop, his head turning,
 * the turn toward you, his hands coming to rest on the cane, a long look, the
 * turn away and his first stride on; then the stride loops again until he has
 * walked off the right of the screen. The page decides only how many strides
 * it takes to bring him to his mark, and to take him away.
 */

export interface FilmFrame {
  /** Which sheet, and where the frame is in it (sheet pixels). */
  s: number
  sx: number
  sy: number
  w: number
  h: number
  /** Where that crop sits in the full frame. */
  dx: number
  dy: number
  /** How far he has come (frame pixels) since the first frame of its part. */
  x: number
}

export interface Film {
  fps: number
  frameWidth: number
  frameHeight: number
  /** His hips (the point the render follows) and his feet, in the frame. */
  originX: number
  originY: number
  /** The top of his head, in the frame. */
  crownY: number
  /** How far one stride of the walk carries him (frame pixels). */
  stride: number
  sheets: string[]
  frames: FilmFrame[]
  /** Indexes into `frames`: the looped stride, then the scene. */
  walk: number[]
  scene: number[]
}

export interface Entrance {
  /** Page pixels per frame pixel. */
  scale: number
  /** The figure's box on the page. */
  width: number
  height: number
  top: number
  /** Left edge of the box when he sets off, and the strides he walks in. */
  startX: number
  strides: number
  /** The strides he walks off in, after the scene. */
  outStrides: number
  /** How long his walk in and the scene last, and the whole of it (ms). */
  walkMs: number
  sceneMs: number
  durationMs: number
  /** Where his hips are while he stands and looks at you (page x). */
  markHips: number
}

/** Where he stops, as a share of the screen's width. */
export const MARK = 0.62

/**
 * His size and his route for a screen `vw` × `vh`: tall and close, but always
 * on the screen; starting off its left edge, walking whole strides to stand
 * with his hips at MARK, and walking on until he is off its right edge.
 */
export function planEntrance(film: Film, vw: number, vh: number): Entrance {
  const tall = Math.min(Math.max(260, vh * 0.56), 520, vw * 1.2)
  const scale = tall / (film.originY - film.crownY)
  const width = film.frameWidth * scale
  const height = film.frameHeight * scale
  const top = vh * 0.96 - film.originY * scale
  const frame = 1000 / film.fps
  const x0 = sceneX(film, 0)
  const standTravel = (standX(film) - x0) * scale
  const sceneTravel = (sceneX(film, film.scene.length - 1) - x0) * scale + (film.stride * scale) / film.walk.length
  const stride = film.stride * scale
  const markHips = vw * MARK
  // Off screen at the start: the right edge of his frame left of the page.
  const offHips = -(film.frameWidth - film.originX) * scale
  const strides = Math.max(2, Math.ceil((markHips - standTravel - offHips) / stride))
  const startHips = markHips - standTravel - strides * stride
  // ...and at the end: the left edge of his frame right of it.
  const sceneEndHips = startHips + strides * stride + sceneTravel
  const outStrides = Math.max(1, Math.ceil((vw + film.originX * scale - sceneEndHips) / stride))
  const cycleMs = film.walk.length * frame
  const walkMs = strides * cycleMs
  const sceneMs = film.scene.length * frame
  return {
    scale,
    width,
    height,
    top,
    startX: startHips - film.originX * scale,
    strides,
    outStrides,
    walkMs,
    sceneMs,
    durationMs: walkMs + sceneMs + outStrides * cycleMs,
    markHips,
  }
}

function sceneX(film: Film, k: number) {
  return film.frames[film.scene[k]!]!.x
}

/** Where he stands through the scene: the place he spends longest. */
export function standX(film: Film): number {
  const count = new Map<number, number>()
  for (const i of film.scene) {
    const x = film.frames[i]!.x
    count.set(x, (count.get(x) ?? 0) + 1)
  }
  let best = sceneX(film, 0)
  for (const [x, n] of count) if (n > (count.get(best) ?? 0)) best = x
  return best
}

/** The frame to show `ms` into his passage (walking in, the scene, walking off). */
export function frameAt(film: Film, plan: Entrance, ms: number): number {
  const frame = 1000 / film.fps
  const stride = (t: number) => film.walk[Math.floor(Math.max(0, t) / frame) % film.walk.length]!
  if (ms < plan.walkMs) return stride(ms)
  if (ms < plan.walkMs + plan.sceneMs) return film.scene[Math.floor((ms - plan.walkMs) / frame)]!
  return stride(Math.min(ms, plan.durationMs - 1) - plan.walkMs - plan.sceneMs)
}

/**
 * His route as keyframes for the figure's box (`translate`, with a fade in
 * over his first steps out of the dark): straight across at walking pace,
 * frame by frame through the scene as his feet carry him, and straight on
 * off the screen.
 */
export function routeKeyframes(film: Film, plan: Entrance): Keyframe[] {
  const at = (x: number) => `translate(${x.toFixed(2)}px, ${plan.top.toFixed(2)}px)`
  const frame = 1000 / film.fps
  const stride = film.stride * plan.scale
  const walkEnd = plan.startX + plan.strides * stride
  const keys: Keyframe[] = [
    { transform: at(plan.startX), opacity: 0, offset: 0 },
    { opacity: 1, offset: Math.min(0.5, (0.4 * film.walk.length * frame) / plan.durationMs) },
    { transform: at(walkEnd), opacity: 1, offset: plan.walkMs / plan.durationMs },
  ]
  const x0 = sceneX(film, 0)
  for (let k = 1; k < film.scene.length; k++) {
    keys.push({
      transform: at(walkEnd + (sceneX(film, k) - x0) * plan.scale),
      offset: (plan.walkMs + k * frame) / plan.durationMs,
    })
  }
  // The scene ends a frame before a stride begins: one frame's pace further on.
  const sceneEnd = walkEnd + (sceneX(film, film.scene.length - 1) - x0) * plan.scale + stride / film.walk.length
  keys.push({ transform: at(sceneEnd), offset: (plan.walkMs + plan.sceneMs) / plan.durationMs })
  // (Opacity said again at the end: a keyframe list that leaves it out fades
  // back to the stylesheet's, which keeps him hidden until he comes.)
  keys.push({ transform: at(sceneEnd + plan.outStrides * stride), opacity: 1, offset: 1 })
  return keys
}
