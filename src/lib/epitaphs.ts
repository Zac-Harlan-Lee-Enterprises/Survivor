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
  'james-parker': {
    recap:
      'James Parker won his first pick of the season by a single point — Detroit 31, New Orleans 30 — and the margins never got any kinder. He won with the 49ers, lost with Seattle 33–31 in Washington, won with Minnesota 15–10, and then did what most of the league did and took Dallas, beaten 24–16 by a Tampa Bay side that had not won a game all season. On his last life he joined twelve others on the Rams, and Arizona beat them 18–16 without scoring a touchdown: six field goals, the last as time expired. He won his first game by one point and lost his last by two, and two of his three losses were by exactly two. And James never once picked alone — the smallest company he kept all season was four, on Seattle, and that one lost too. Rest in peace, James: proof that there is no safety in numbers, only witnesses.',
    writtenAfterWeek: 6,
  },
  'stacey-markendorff': {
    recap:
      'Stacey Markendorff’s season was bookended by the Arizona Cardinals, who have won two games all year and spent both of them on her. In week 1 she was one of seven on the Chargers, and Arizona won 26–14; in week 6 she was one of thirteen on the Rams, and Arizona won 18–16 on six field goals, the last with no time on the clock. In between she was flawless for three straight weeks — San Francisco, Kansas City and Minnesota, never in a crowd smaller than eleven — before joining the twenty-one on Dallas, beaten by a Tampa Bay team that had not won all season. The Chargers are now 0–6, which means her first loss was not bad luck; it was the Chargers. Rest in peace, Stacey. Arizona will never know what it did to you, which somehow makes it worse.',
    writtenAfterWeek: 6,
  },
  'sheila-acker': {
    recap:
      'Sheila Acker beat New England 13–10 with Seattle in week 1, and from there her season split neatly down the middle. The teams she won with — Seattle, Kansas City and Minnesota — are a combined 13–3. The teams she lost with — Tampa Bay, Dallas and the Rams — are a combined 5–13. Same thirteen, wrong side of the dash. Tampa Bay cost her a life by losing to Cleveland in week 2 and another by beating her Cowboys in week 5, which is the Bucs being thorough, and on her last life she was one of thirteen on the Rams, who led Arizona with forty-seven seconds left and lost 18–16 on the last kick of the game. Rest in peace, Sheila. She picked the right half of the league three times and the wrong half three times, and the wrong half went last.',
    writtenAfterWeek: 6,
  },
  'chloe-bourque': {
    recap:
      'Chloe Bourque had a habit of beating a team and then picking against it again, and the teams took it personally. She beat Cleveland with Jacksonville in week 1, 34–10, and in week 2 Cleveland beat her Buccaneers 23–19. She beat Tennessee with Baltimore in week 4, 24–18, and in week 6 Tennessee, 0–5, went to Indianapolis and won 26–20 for its first win of the season, on a blocked punt and four field goals by a kicker named Joey. In between she won with Kansas City alongside nineteen others and lost with Dallas alongside twenty. She is the only one of us who went from the Cowboys straight to the Colts, and nobody will be copying it. Rest in peace, Chloe. Revenge is a dish best served by a winless team.',
    writtenAfterWeek: 6,
  },
  'corey-cowell': {
    recap:
      'Corey Cowell spent half his season on his last life and handled it better than anyone. He opened with Pittsburgh, one of only two of us on the Steelers, and won 20–13. Then Tampa Bay lost to Cleveland, Seattle lost 33–31 in Washington, and from week 4 he was down to one life — where he took Minnesota and won 15–10, then took Houston, one of two on the Texans, and watched them win their first game of the season 26–3 in Tennessee. In week 6 he left Houston for the Colts. Houston won again. The Colts lost 26–20 to Tennessee, the very team his Texans had beaten by twenty-three a week earlier. Everyone who picked Seattle in week 3 is now dead, though Corey held out two weeks longer than Don. Rest in peace, Corey: three weeks on one life, and two of them were wins.',
    writtenAfterWeek: 6,
  },
  'matt-hadley': {
    recap:
      'Matt Hadley was the only person in the league to pick Green Bay in week 1, and Minnesota beat them 39–22. The Vikings have not lost since, so call it scouting. He then won three straight with company — San Francisco, Kansas City, Baltimore — and went with the crowd twice more: Dallas in week 5 with twenty others, beaten by Tampa Bay, and the Rams in week 6 with twelve others, beaten 18–16 by six Arizona field goals. That same weekend Green Bay beat Dallas 23–13, which settled nothing for Matt, who had lost a life to each of them and was busy losing his last to the Rams. Rest in peace, Matt. He picked the Packers when nobody else would, and spent five weeks trying to make up for it.',
    writtenAfterWeek: 6,
  },
  'kc-walker': {
    recap:
      'KC Walker took Kansas City in week 3 along with nineteen others, so for one Sunday the most popular pick in the league was named after him — and it won, 24–10 in Miami. It was the high point of a season spent running with the crowd: one of seven on Jacksonville in week 1 (won 34–10), one of seven on Tampa Bay in week 2 (lost 23–19 to Cleveland), one of sixteen on Minnesota (won 15–10), one of twenty-one on Dallas (lost) and one of thirteen on the Rams, beaten 18–16 by a field goal with no time left. Kansas City are 5–0, and he can never pick them again, because he already spent them on himself. Rest in peace, KC. The only time KC picked KC, KC won.',
    writtenAfterWeek: 6,
  },
  'paul-lim': {
    recap:
      'Paul Lim is the only one of us ever to lose a life to a tie. He started cleanly — Jacksonville over Cleveland, 34–10 — then lost with Tampa Bay in week 2, won with Kansas City and Minnesota, and in week 5 went alone with Washington, who tied the Giants 27–27, which under the rules costs a life exactly like a loss. Washington are now 1–4–1, so that tie is the second-best result they have managed all season, and Paul was charged for it as if it were the worst. On his last life he joined twelve others on the Rams, who were winning with forty-seven seconds to go and lost 18–16 on a field goal at the gun. Rest in peace, Paul: the only man in this league buried partly by a game nobody lost.',
    writtenAfterWeek: 6,
  },
  'tony-canody': {
    recap:
      'Tony Canody once beat seven of us at once. In week 2, seven people took Tampa Bay against Cleveland; Tony alone took Cleveland, and Cleveland won 23–19. The rest of his season was spent in company, and the company was mostly Los Angeles. He opened as one of seven on the Chargers, beaten 26–14 by Arizona — the Chargers have not won a game since, and are 0–6 — and he finished as one of thirteen on the Rams, beaten 18–16 by Arizona. Arizona have won two games all season, one against each Los Angeles team, and Tony picked Los Angeles both times. In between he won with Kansas City and Baltimore and lost with Dallas, along with twenty others. Rest in peace, Tony. The one time he went alone, he was right.',
    writtenAfterWeek: 6,
  },
  'joanna-moss': {
    recap:
      'Joanna Moss was the first person in this league to be burned by the Dallas Cowboys. In week 1 she was the only one of us on Dallas, and they lost 28–20 at the Giants; four weeks later twenty-one people followed her lead, and she, having learned, was not one of them. She won with Buffalo in week 2, 41–31 over Detroit, lost with Seattle 33–31 in week 3, and spent the next three weeks on her last life: Baltimore 24–18 over Tennessee, then Houston, with only Corey for company, 26–3 in Tennessee. In week 6 she and Corey went to Indianapolis together, and Tennessee — a team she had beaten two weeks running — beat the Colts 26–20 for its first win of the season. Rest in peace, Joanna. She beat Tennessee twice, and the third time, Tennessee got her.',
    writtenAfterWeek: 6,
  },
  'tina-bush': {
    recap:
      'Tina Bush lived by one principle: if you can’t beat them, pick them. In week 4 she was the only one of us on Buffalo, and New England beat them 29–26; so in week 5 she picked New England, alone again, and they beat the Raiders 45–17. New England won again in week 6, 26–19 over the Jets, but you can only use a team once and she already had, so she joined twelve others on the Rams, who lost 18–16 to a field goal as the clock ran out. Before all that: Detroit by a point in week 1, no pick at all in week 2 — which the rules treat exactly like a loss — and Kansas City in week 3. New England have won four games this season, and two of them came at her expense or on her behalf. Rest in peace, Tina: New England’s most complicated relationship.',
    writtenAfterWeek: 6,
  },
  'zac-harlan': {
    recap:
      'Zac Harlan is the commissioner of this league and, as of week 6, one of its headstones, which makes this the first epitaph in league history written by the deceased. He never picked alone — the smallest crowd he joined all season was seven, on the Chargers in week 1, and Arizona beat them 26–14. Then three straight wins with company — San Francisco, Kansas City, Baltimore — before he joined both of the biggest losing crowds of the season: twenty-one on Dallas in week 5 and thirteen on the Rams in week 6. Arizona have won two games all year, one against each Los Angeles team, and the commissioner had Los Angeles both times. The Chargers are 0–6. The Rams are 2–4. He has no further comment. Rest in peace, Zac. The notes will keep coming; they just come from lower down now.',
    writtenAfterWeek: 6,
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
