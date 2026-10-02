/**
 * Epitaphs for the fallen, written by hand when someone loses their last life.
 *
 * Editorial copy, like the commissioner's note: drafted from the player's real
 * pick history, every claim pinned by tests/unit/epitaphFacts.test.ts, and
 * reviewed by the commissioner in a PR before it is carved. Past weeks are
 * public, so an epitaph may name picks freely. Cheeky, never cruel.
 *
 * Keyed by player id. An eliminated player with no entry yet gets a
 * placeholder on their profile until the commissioner has found the words.
 */
export interface Epitaph {
  lines: string[]
  /** The week whose result put them here — asserted to match the engine. */
  writtenAfterWeek: number
}

export const EPITAPHS: Record<string, Epitaph> = {}
