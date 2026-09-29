import { Megaphone, Send } from 'lucide-react'

/**
 * The commissioner's note to the league, between the scoreboard and the
 * standings.
 *
 * The copy is editorial and lives here on purpose: it is written for one moment
 * in the season, not derived from the data. `week` gates it, so when the league
 * moves on and nobody has written the next one, the section simply is not
 * there rather than shouting about a week gone by.
 *
 * Every number below is checked: the pick counts and matchups come from the
 * seeded season and the real cached schedule, and the results are the ones on
 * the ESPN scoreboard and in the game recaps, pinned in
 * tests/unit/leagueMessageFacts.test.ts. A made-up stat in a note addressed to
 * the whole league would be found out by Sunday lunchtime.
 */

/**
 * Mapped to weeks 1 through 4 on purpose. The seed carries no results, so the
 * engine calls week 1 current until the live sync lands them, at which point
 * week 4 is — and the league needs the review under whichever key it is shown.
 *
 * Week 3's picks are public now (the first kickoff has passed), so the review
 * may name them. It must say nothing about week 4 picks, which are hidden until
 * Thursday's kickoff.
 */
const WEEK_3_REVIEW = {
  heading: 'Word from the commissioner',
  lines: [
    'Week 3 is in the books and twenty-four of thirty survived it, which by this league’s standards is a clean sheet. Nobody is out. Eight of you still hold all three lives, fifteen are on two, and seven are down to one — enough people on the ledge to form a support group, and at this rate, enough to need one.',
    'Twenty of you took Kansas City. Two thirds of the league, one team, the least surprising event in the history of group chats. The Chiefs won 24–10, and Patrick Mahomes completed twenty passes — one for each of you, like party favours. Miami have now scored thirteen or fewer in all three games; last week I called it a thermostat, and they turned it down to ten. All twenty of you survived, and all twenty of you can never use Kansas City again, which you will be thinking about in December.',
    'Then there is Seattle. Joanna, James, Don and Corey took the defending champions at Washington’s home opener, and I wrote that Joanna was counting on the housewarming going badly. It went beautifully, for Washington. A backup linebacker named Kain Medrano intercepted Sam Darnold and returned it fifty yards for the winning score with 3:57 left, a backup quarterback named Marcus Mariota ran for the first down that closed it out, and Washington won 33–31. Seattle had won twelve straight, including a Super Bowl. They were beaten by two backups. Four of you went down with them. Jaxon Smith-Njigba had ten catches, 128 yards and two touchdowns, and has an alibi.',
    'Corey and Don have now picked the same team twice — Pittsburgh in week 1, Seattle in week 3 — and are both on one life, which is either friendship or a shared weakness. Joanna has never once picked the week’s most popular team, and she has one life left to show for her independence. It is a principled position. It is also an expensive one.',
    'Phyllis was alone on Green Bay, at home on Thursday night to an Atlanta side that had lost 34–3 four days earlier. I wrote that I was allowed to raise an eyebrow. Atlanta gave Michael Penix Jr. his first start of the year, Bijan Robinson ran for 194 yards, and the Falcons won 35–14 at Lambeau, ending Green Bay’s run of thirteen straight home-opener wins. My eyebrow has been lowered. I apologise to Phyllis, who has the grace to still be on two lives.',
    'And now, Joey. Joey is a Chicago Bears fan. Joey had the whole slate to choose from this week and chose to pick against the Chicago Bears, at Soldier Field, on Monday Night Football, with the Bears starting their backup quarterback. Case Keenum — thirty-eight years old, on his eighth NFL team, playing his first regular-season snaps since 2023 — threw two touchdowns and ran for another; the Eagles turned it over three times and forced none; Chicago won 27–7. Joey lost a life to his own team. He was the last person in the league to find out whether he survived, and we can only assume he found out in a Bears jersey, cheering for both sides and neither. Joey is now down to one life. The Bears are 2–1. Joey, we checked: you are allowed to pick your own team. You are also allowed to pick against them. You are not allowed to do the second one and then lose to them. That one stays with a man.',
    'Other escapes. Nate and Melanie had San Francisco, where Arizona got within two with 2:51 left before Brock Purdy found George Kittle and Deebo Samuel recovered an onside kick; Nate, on his last life, survived by the width of one onside kick. Jared, also on one life, took Buffalo against the Chargers, the team that took his first — and Buffalo turned the ball over five times and still won 24–16, only the second time in franchise history they have won with five or more turnovers. Revenge, served in the most stressful way available. Jason was the only one of you on Detroit, who scored thirty-one points for the third game running and needed a go-ahead catch from Jahmyr Gibbs with 2:25 left to do it.',
    'The eight still perfect: Allison, Cindy, Dominic, Jason, Mike, Shahid, Tracy and Wesley. Allison is among them. I remain slightly afraid of her. The Chargers, for their part, are 0–3 for the first time since 2017, and seven of us bought in back in week 1. We are no longer investors. We are a cautionary tale with a group chat.',
    'Week 4 has no byes. Kansas City visit Las Vegas, both 3–0, and twenty of you can only watch. Miami, still stuck on the thermostat, visit 3–0 Minnesota. Green Bay visit 0–3 Tampa Bay, a fixture that has cost nine of you a life between them. The 0–3 Chargers visit Seattle, who have just been beaten by a linebacker. Indianapolis play Washington in London at 8:30 on Sunday morning our time, for anyone who wants their week settled before breakfast. And Thursday night is Pittsburgh at Cleveland, which is what locks the week.',
  ],
  // Set apart from the banter, because an instruction buried in jokes is an
  // instruction somebody misses — and seven people are on their last life.
  callout:
    'DM me your week 4 pick on Teams before 7:10 PM Thursday — five minutes before Pittsburgh at Cleveland kicks off. A missing pick costs a life, and seven of you have exactly one.',
}

const NOTES: Record<number, { heading: string; lines: string[]; callout?: string }> = {
  1: WEEK_3_REVIEW,
  2: WEEK_3_REVIEW,
  3: WEEK_3_REVIEW,
  4: WEEK_3_REVIEW,
}

export function LeagueMessage({ week }: { week: number }) {
  const note = NOTES[week]
  if (!note) return null

  return (
    <section className="card border-sky-400/25 p-5 md:p-6" aria-labelledby="league-message-title">
      <h2 id="league-message-title" className="eyebrow flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-sky-400" aria-hidden="true" />
        {note.heading}
      </h2>
      <div className="mt-3 space-y-2 text-ink-200">
        {note.lines.map((line) => (
          <p key={line} className="max-w-3xl leading-relaxed">
            {line}
          </p>
        ))}
      </div>
      {note.callout && (
        // Set apart from the banter on purpose: an instruction buried in a
        // joke is an instruction somebody misses, and missing costs a life.
        <p className="mt-4 flex max-w-3xl items-start gap-3 rounded-xl border border-gold-400/40 bg-gold-400/10 p-4 font-medium text-ink-100">
          <Send className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" aria-hidden="true" />
          <span>{note.callout}</span>
        </p>
      )}
    </section>
  )
}
