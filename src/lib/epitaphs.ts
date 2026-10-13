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
 * Keyed by player id. An eliminated player with no entry yet gets an epitaph
 * written from their record (`autoEpitaph`) until the commissioner has found
 * the words — see `epitaphFor`.
 */
import type { PlayerStanding } from '@/domain'
import { autoEpitaph } from './copy'

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
  'craig-mowers': {
    recap:
      'Craig Mowers spent most of his season on his last life, which is what happens when you open with the Chargers and then forget to send a pick. Week 1 he was one of the seven of us who rode Los Angeles into a 26–14 loss to Arizona; week 2 he sent nothing at all, and the rules count nothing as a loss with better manners. So from week 3 Craig was walking a tightrope, and for two weeks he walked it beautifully: Kansas City, 24–10 at Miami, then Chicago, 23–12 over the Jets. Then, on the Monday of week 5, he sent the most organised message this league has ever received: “Dallas week 5 so I don’t forget later.” He did not forget. It did not help. Tampa Bay, 0–4 and on a rookie quarterback, won 24–16. Rest in peace, Craig: the most punctual man ever buried by the Cowboys.',
    writtenAfterWeek: 5,
  },
  'jared-marks': {
    recap:
      'Jared Marks’s season was a lesson in timing. Week 1, the Chargers, 26–14 to Arizona, one of seven. Week 2, a pick that reached the commissioner on Friday morning — after the lock, after the opener had been played — which the rules treat exactly like no pick at all. That left Jared on his last life by week 3, where he took Buffalo against the very Chargers who had cost him his first, and won 24–16 despite five Buffalo turnovers: revenge, served as stressfully as possible. Then Minnesota, 15–10, five field goals and no touchdowns, a win that looked like a hostage negotiation. And in week 5 he sent the most honest pick of the season: “cowboys - i’ll join the band wagon this week.” The bandwagon drove off a cliff, Tampa Bay 24, Dallas 16, and Jared went with the biggest crowd this league has ever formed — twenty-one on one team. Rest in peace, Jared. Never follow a crowd that big.',
    writtenAfterWeek: 5,
  },
  'joseph-tomczuk': {
    recap:
      'Joey Tomczuk is a Chicago Bears fan, and his season reads like a man trying to get away from them. Week 1 he took Jacksonville and won 34–10, the last uncomplicated thing that happened to him. Week 2 he took Tampa Bay and lost 23–19 to Cleveland after a two-hour lightning delay. Week 3, on his second life, he picked against his own Bears at Soldier Field on Monday night and was beaten 27–7 by a thirty-eight-year-old backup on his eighth NFL team. Week 4, on his last life, he backed Minnesota — a Bears division rival — and survived 15–10 on five field goals. And in week 5 he sent one word, “Cowboys!”, and went down with twenty others. That same weekend the Bears lost 31–7 at Green Bay, so in the end Joey and the Bears finally suffered together. Rest in peace, Joey: picked against the Bears once all season, and they won by twenty.',
    writtenAfterWeek: 5,
  },
  'nate-adams': {
    recap:
      'Nate Adams holds this league’s record for the most specific misfortune: he is the only one of us burned by both the Chargers (26–14 to Arizona, week 1) and the Buccaneers (23–19 to Cleveland, week 2, after a two-hour lightning delay). That put him on his last life by week 3, where he took the unbeaten 49ers, watched Arizona close to within two with 2:51 left, and survived by the width of an onside kick. Then Minnesota, 15–10, without a touchdown in sight. Then week 5, when his pick arrived as a Teams message that read, in full, “My pick” — no team attached — and the commissioner had to confirm it was Dallas. It was Dallas. Tampa Bay won 24–16. The Bucs cost Nate a life in week 2 by losing and finished him in week 5 by winning, which is the kind of bookending this man attracts. Rest in peace, Nate.',
    writtenAfterWeek: 5,
  },
  'phyllis-collins': {
    recap:
      'Phyllis Collins picked the opening game of the week every single week — five weeks, five openers — so for her whole season she knew her fate before the rest of us had made a sandwich. For two weeks that was a luxury: Seattle by three over New England, then Buffalo, where Josh Allen scored five touchdowns in the first game at the new stadium. Then the openers turned on her. Week 3, Green Bay at home to an Atlanta side that had just lost 34–3: Falcons 35–14. Week 4, Pittsburgh at Cleveland, beaten 27–24 by a 56-yard field goal with ten seconds left. And week 5, on her last life, “Going with Dallas tonight”: Tampa Bay won its first game of the season, 24–16. Two wins, then three straight losses, every one of them settled while the rest of the league still had a whole weekend ahead of it. Rest in peace, Phyllis. She was always the first to know.',
    writtenAfterWeek: 5,
  },
}

/**
 * The epitaph a fallen player's profile shows: the commissioner's own words
 * when he has written them for the week this player actually went out, and
 * the record's otherwise. A corrected result can move someone's elimination
 * week, and a recap carved for the old one would then be false — so it waits
 * for the engine to agree with it again.
 */
export function epitaphFor(
  playerId: string,
  displayName: string,
  standing: PlayerStanding,
): string | null {
  if (standing.status !== 'eliminated') return null
  const carved = EPITAPHS[playerId]
  if (carved && carved.writtenAfterWeek === standing.eliminatedWeek) return carved.recap
  return autoEpitaph(displayName, standing)
}
