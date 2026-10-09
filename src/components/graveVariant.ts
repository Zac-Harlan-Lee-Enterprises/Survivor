/**
 * What makes one grave look like itself and not the one beside it. A row of
 * fresh graves all cut from the same stone, leaning the same way, with the
 * same crow on the same shoulder, reads as a copy-paste; real graveyards are
 * a mix. Everything here is derived from the player id, so a grave looks the
 * same on every visit and nobody's stone changes shape on a refresh.
 */
export type GraveShape = 'round' | 'gothic' | 'crowned'
export type GraveTint = 'grey' | 'warm' | 'slate'

export interface GraveVariant {
  shape: GraveShape
  tint: GraveTint
  /** Degrees the stone has settled off true, −2 to 2. */
  lean: number
  /** Which shoulder the crow perches on; it faces outward and flies in head first. */
  crowSide: 'left' | 'right'
  /** Which way the ghost drifts as it rises. */
  sway: 1 | -1
}

/** FNV-1a: small, stable, and spreads similar ids apart. */
export function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const SHAPES: GraveShape[] = ['round', 'gothic', 'crowned']
const TINTS: GraveTint[] = ['grey', 'warm', 'slate']

export function graveVariant(playerId: string): GraveVariant {
  const h = hash(playerId)
  return {
    shape: SHAPES[h % 3]!,
    tint: TINTS[(h >>> 4) % 3]!,
    lean: Math.round((((h >>> 8) % 1000) / 1000) * 40 - 20) / 10,
    crowSide: (h >>> 12) % 2 ? 'left' : 'right',
    sway: (h >>> 16) % 2 ? 1 : -1,
  }
}
