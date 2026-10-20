import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** The parts of src/lib/deathFilm.ts's Film this checks (read from disk, as the other fact tests do). */
interface Film {
  /** How far his elbows and forearms stay outside his body at the closest, over every frame (cm). */
  armClearance: number
  frameWidth: number
  frameHeight: number
  stride: number
  sheets: string[]
  frames: { s: number; w: number; h: number; dx: number; dy: number; x: number }[]
  walk: number[]
  scene: number[]
}
const FILM = JSON.parse(readFileSync('src/components/deathFrames.json', 'utf8')) as Film

/** The film scripts/art/death_film.py packed: what the page will draw. */
describe('the rendered film', () => {
  it('has a looped stride, a scene, and every sheet it draws from', () => {
    expect(FILM.walk.length).toBeGreaterThanOrEqual(24)
    expect(FILM.scene.length).toBeGreaterThan(FILM.walk.length)
    for (const src of FILM.sheets) expect(existsSync(join('public', src)), src).toBe(true)
    for (const i of [...FILM.walk, ...FILM.scene]) {
      const f = FILM.frames[i]!
      expect(FILM.sheets[f.s], `frame ${i}`).toBeTruthy()
      // Every crop lies inside the frame it was cut from.
      expect(f.dx + f.w).toBeLessThanOrEqual(FILM.frameWidth)
      expect(f.dy + f.h).toBeLessThanOrEqual(FILM.frameHeight)
    }
  })

  it('keeps his arms outside his body in every frame (measured when the take was rendered)', () => {
    // Facing you with his hands on the cane, his arms once passed through his
    // chest. death_scene.py measures every rendered frame against his torso.
    expect(FILM.armClearance).toBeGreaterThan(0)
  })

  it('walks him forward every stride; in the scene he stops, stands a long while, and walks on', () => {
    expect(FILM.stride).toBeGreaterThan(0)
    const walk = FILM.walk.map((i) => FILM.frames[i]!.x)
    for (let k = 1; k < walk.length; k++) expect(walk[k]).toBeGreaterThan(walk[k - 1]!)
    const scene = FILM.scene.map((i) => FILM.frames[i]!.x)
    // Never backward.
    for (let k = 1; k < scene.length; k++) expect(scene[k]).toBeGreaterThanOrEqual(scene[k - 1]!)
    // Standing (the turn, the hands, the stare, the turn away): over eight seconds in one place.
    const counts = new Map<number, number>()
    for (const x of scene) counts.set(x, (counts.get(x) ?? 0) + 1)
    expect(Math.max(...counts.values())).toBeGreaterThan(8 * 20)
    // ...and it ends on the move, a stride's pace, into the looped stride.
    const pace = FILM.stride / FILM.walk.length
    expect(scene.at(-1)! - scene.at(-2)!).toBeGreaterThan(pace * 0.8)
  })
})
