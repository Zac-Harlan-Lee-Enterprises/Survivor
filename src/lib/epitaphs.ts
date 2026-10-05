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

export const EPITAPHS: Record<string, Epitaph> = {
  'don-turner': {
    recap:
      'Don Turner opened the season like a man who had read the manual: Pittsburgh at home in week 1, a tidy 20–13 over Atlanta, three lives intact, nothing to see here. Then he went looking for trouble and found it three weeks running. Week 2, Baltimore at home, up 14–3 at the half, undone by a Tyler Shough fourth-down sneak the league’s replay office could not prove didn’t happen. Week 3, the defending-champion Seahawks in Washington’s home opener, beaten 33–31 by a backup linebacker’s pick-six. And week 4, on his last life, Detroit on Sunday night in Carolina — the Panthers’ first Sunday night game since 2015 — where Jared Goff threw for 412 yards and it bought Don nothing, because Carolina scored on six straight possessions and won 32–26. Three losses by seven, two and six points: never blown out, just quietly, consistently wrong. He picked the same team as Corey in weeks 1 and 3 and the same team as Dave and Maya in week 2, so he never once suffered alone, which is more than most of us can say. Rest in peace, Don. Twenty-eight teams go unused, every one of them wondering what it did to be spared.',
    writtenAfterWeek: 4,
  },
}
