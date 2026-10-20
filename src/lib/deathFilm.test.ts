import { describe, expect, it } from 'vitest'
import { MARK, frameAt, planEntrance, routeKeyframes, standX, type Film } from './deathFilm'

/**
 * A small film: a four-frame stride of 100px; then a scene that slows to a
 * stop 30px on, stands there, and sets off again (45px).
 */
const film: Film = {
  fps: 20,
  frameWidth: 200,
  frameHeight: 400,
  originX: 100,
  originY: 380,
  crownY: 20,
  stride: 100,
  sheets: ['death/a.webp'],
  frames: [
    ...[0, 25, 50, 75].map((x) => ({ s: 0, sx: 0, sy: 0, w: 10, h: 10, dx: 0, dy: 0, x })),
    ...[0, 20, 30, 30, 30, 30, 45].map((x) => ({ s: 0, sx: 0, sy: 0, w: 10, h: 10, dx: 0, dy: 0, x })),
  ],
  walk: [0, 1, 2, 3],
  scene: [4, 5, 6, 7, 8, 9, 10],
}

const px = (key: Keyframe) => Number(/translate\(([-\d.]+)px/.exec(String(key.transform))![1])
const SCREENS = [
  [1280, 800],
  [390, 844],
  [2560, 1440],
] as const

describe('standX', () => {
  it('is where he spends longest in the scene', () => {
    expect(standX(film)).toBe(30)
  })
})

describe('planEntrance', () => {
  it('brings him in from off the left of the screen to his mark, in whole strides', () => {
    for (const [vw, vh] of SCREENS) {
      const plan = planEntrance(film, vw, vh)
      // Off screen to begin with: the right edge of his frame left of the page.
      expect(plan.startX + plan.width).toBeLessThanOrEqual(0.001)
      const standing = plan.startX + plan.strides * film.stride * plan.scale + 30 * plan.scale
      expect(standing + film.originX * plan.scale).toBeCloseTo(vw * MARK, 6)
      expect(Number.isInteger(plan.strides)).toBe(true)
      expect(plan.strides).toBeGreaterThanOrEqual(2)
    }
  })

  it('takes him off the right of the screen afterwards, in whole strides', () => {
    for (const [vw, vh] of SCREENS) {
      const plan = planEntrance(film, vw, vh)
      const keys = routeKeyframes(film, plan)
      // The left edge of his frame past the right edge of the page.
      expect(px(keys.at(-1)!)).toBeGreaterThanOrEqual(vw)
      expect(Number.isInteger(plan.outStrides)).toBe(true)
      expect(plan.durationMs).toBe(plan.walkMs + plan.sceneMs + plan.outStrides * 4 * 50)
    }
  })

  it('stands him tall but on the screen: crown below the top, feet near the bottom', () => {
    for (const [vw, vh] of [...SCREENS, [320, 480] as const]) {
      const plan = planEntrance(film, vw, vh)
      const crown = plan.top + film.crownY * plan.scale
      const feet = plan.top + film.originY * plan.scale
      expect(crown).toBeGreaterThan(0)
      expect(feet).toBeCloseTo(vh * 0.96, 6)
      expect(feet - crown).toBeLessThanOrEqual(520.001)
    }
  })
})

describe('frameAt', () => {
  const plan = planEntrance(film, 1280, 800)
  const frame = 1000 / film.fps

  it('loops the stride walking in, plays the scene once, and loops the stride walking off', () => {
    expect(frameAt(film, plan, 0)).toBe(0)
    expect(frameAt(film, plan, 3 * frame + 1)).toBe(3)
    expect(frameAt(film, plan, 4 * frame + 1)).toBe(0)
    expect(frameAt(film, plan, plan.walkMs - 1)).toBe(3)
    expect(frameAt(film, plan, plan.walkMs)).toBe(4)
    expect(frameAt(film, plan, plan.walkMs + 6 * frame)).toBe(10)
    const off = plan.walkMs + plan.sceneMs
    expect(frameAt(film, plan, off)).toBe(0)
    expect(frameAt(film, plan, off + 2 * frame)).toBe(2)
    expect(frameAt(film, plan, plan.durationMs + 5000)).toBe(3)
  })
})

describe('routeKeyframes', () => {
  it('carries him at walking pace, as far as each frame of the scene says, then on at walking pace', () => {
    const plan = planEntrance(film, 1280, 800)
    const keys = routeKeyframes(film, plan)
    const offsets = keys.map((k) => Number(k.offset))
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets)
    expect(offsets.at(-1)).toBe(1)
    const moving = keys.filter((k) => k.transform)
    const s = plan.scale
    expect(px(moving[0]!)).toBeCloseTo(plan.startX, 2)
    const walkEnd = plan.startX + plan.strides * film.stride * s
    expect(px(moving[1]!)).toBeCloseTo(walkEnd, 2)
    // Frame by frame through the scene: standing still while he stands.
    expect(px(moving[3]!)).toBeCloseTo(walkEnd + 30 * s, 2)
    expect(px(moving[5]!)).toBeCloseTo(walkEnd + 30 * s, 2)
    // Off he goes: the scene's last step and one frame's pace on, then whole strides.
    const sceneEnd = walkEnd + 45 * s + (film.stride * s) / 4
    expect(px(moving.at(-2)!)).toBeCloseTo(sceneEnd, 2)
    expect(px(moving.at(-1)!)).toBeCloseTo(sceneEnd + plan.outStrides * film.stride * s, 2)
  })

  it('keeps him solid to the end, once he has come out of the dark', () => {
    const keys = routeKeyframes(film, planEntrance(film, 1280, 800))
    expect(keys[0]!.opacity).toBe(0)
    const later = keys.filter((k) => k.opacity !== undefined).slice(1)
    expect(later.length).toBeGreaterThan(0)
    for (const k of later) expect(k.opacity).toBe(1)
    expect(keys.at(-1)!.opacity).toBe(1)
  })
})
