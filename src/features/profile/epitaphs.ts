/**
 * Epitaphs for the fallen: a one-paragraph recap of the player's own season,
 * written when they lose their last life and shown on their profile under
 * their headstone.
 *
 * The house style, set by the commissioner: very factually accurate, super
 * funny, a bit edgy — the register of his season recaps. Every pick, score and
 * stat in it is real, drafted from the player's pick history and the actual
 * results, pinned by tests/unit/epitaphFacts.test.ts, and reviewed by the
 * commissioner in a PR before it is carved. Past weeks are public, so it may
 * name picks freely. Edgy about the picks, never cruel about the person.
 *
 * Keyed by player id. An eliminated player with no entry yet gets a
 * placeholder on their profile until the commissioner has found the words.
 */
export interface Epitaph {
  /** One paragraph: their season, start to finish. */
  recap: string
  /** The week whose result put them here — asserted to match the engine. */
  writtenAfterWeek: number
}

export const EPITAPHS: Record<string, Epitaph> = {}
