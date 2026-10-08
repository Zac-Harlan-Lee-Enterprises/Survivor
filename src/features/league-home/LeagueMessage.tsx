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
 * Mapped to weeks 1 through 5 on purpose. The seed carries no results, so the
 * engine calls week 1 current until the live sync lands them, at which point
 * week 5 is — and the league needs the review under whichever key it is shown.
 *
 * Week 4 is public (its first kickoff has passed), so the review names picks.
 * It says nothing about week 5 picks, which are hidden until Thursday.
 */
const WEEK_4_REVIEW = {
  heading: 'Word from the commissioner',
  lines: [
    'Week 4 is done a day early: nobody in this league touched Monday night’s game, so New Orleans and Atlanta can play it in peace and, for once, nobody’s week depends on a Monday. Here is the damage. Sixteen of you took Minnesota, who beat Miami 15–10 with five field goals and no touchdown, their second straight game without one. More than half this league was carried by a team that cannot find the end zone. Eight of you took Baltimore, 24–18 over Tennessee. Dave and Craig took Chicago, 23–12 over the Jets. All twenty-six of you are fine.',
    'Dominic also took Baltimore. Baltimore won. Dominic lost a life anyway, because he had already used the Ravens in week 1, and the rulebook does not have a box marked “but they won”. That is a new way to lose in this league, and I salute the creativity.',
    'Phyllis went early with Pittsburgh on Thursday night and lost 27–24 to a 56-yard field goal with ten seconds left; Cleveland are now 8–0 on Thursday nights, the least Cleveland fact ever recorded. Tina took Buffalo, unbeaten until Sunday, and lost them 29–26 to a one-handed catch with 1:50 to go: the Bills’ first loss of the year and their first ever in the new stadium. Both are down to one life. Both picked a team that had every right to win. That is the game.',
    'And then there is Don. Don took Detroit on Sunday night in Carolina on his last life, and Carolina, the team that gave up fifty-nine points to Chicago in week 1, scored on six straight possessions and won 32–26. Jared Goff threw for 412 yards; it bought Don nothing. Don is the first member of the Sunday Survivors to lose all three lives, and he did it the hard way: three straight losses, by seven, two and six points. His headstone is on this page. His epitaph is on his profile. Don, we hardly knew your picks.',
    'Where we stand: twenty-nine alive. Seven on three lives (Allison, Cindy, Jason, Mike, Shahid, Tracy and Wesley), fourteen on two, and eight on one: Corey, Craig, Jared, Joanna, Joey, Nate, Phyllis and Tina. Eight people one bad Sunday from a headstone. The crow has been told.',
    'Week 5 has byes: Carolina and Kansas City sit out, so thirty teams on the menu. Thursday night is Tampa Bay at Dallas, which locks the week. Philadelphia and Jacksonville play in London at 8:30 on Sunday morning our time, again. Minnesota, 4–0 and still waiting for a touchdown, are spent for sixteen of you; Kansas City are spent for twenty, which costs nothing this week since they are on the sofa anyway.',
  ],
  // Set apart from the banter, because an instruction buried in jokes is an
  // instruction somebody misses — and eight people are on their last life.
  callout:
    'DM me your week 5 pick on Teams before 7:10 PM Thursday — five minutes before Tampa Bay at Dallas kicks off. A missing pick costs a life, and eight of you have exactly one.',
}

const NOTES: Record<number, { heading: string; lines: string[]; callout?: string }> = {
  1: WEEK_4_REVIEW,
  2: WEEK_4_REVIEW,
  3: WEEK_4_REVIEW,
  4: WEEK_4_REVIEW,
  5: WEEK_4_REVIEW,
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
