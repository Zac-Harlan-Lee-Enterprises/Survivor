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
 * week 5 is — and the league needs the note under whichever key it is shown.
 *
 * Published after Thursday's kickoff, when week 5's picks are public, so it
 * names them. No callout: the picks are locked and nothing is owed.
 */
const WEEK_5_KICKOFF = {
  heading: 'Word from the commissioner',
  lines: [
    'Picks are locked and the secret is out: twenty-one of you are on Dallas tonight. Twenty-one of twenty-nine, on a Cowboys team that is 2–2, at home to a Tampa Bay team that is 0–4 — which is either the safest pick this league has ever made or the setup for the most catastrophic Thursday in its history, and we will know by about ten o’clock. Craig, Jared, Joey, Nate and Phyllis are all on their last life and all on Dallas, so if the Bucs win their first game of the season tonight, the crow is going to need a bigger stone. Joey, for the record, has now gone Eagles, Vikings and Cowboys in successive weeks: three NFC teams in a row, not one of them the Bears.',
    'The other eight of you saw twenty-one people climbing onto the Cowboys bandwagon and decided to walk. Cindy, Dave, Melanie and Allison took Cincinnati at a Miami team that has scored thirteen points or fewer in every game this season. Joanna and Corey took Houston at Tennessee, which is an 0–4 team visiting an 0–4 team — somebody’s losing streak ends on Sunday, and Corey, on his last life, needs it to be Houston’s. Paul has Washington, 1–3, at home to the 3–1 Giants, which takes either nerve or a spreadsheet the rest of us haven’t seen. And Tina, also on her last life, has taken New England — the team that knocked her Bills off last week. If you can’t beat them, pick them. Nobody has a stake in London or on Monday night, and all twenty-nine picks arrived before the lock, the last of them at 5:41 — thank you, James.',
  ],
  // No callout: the picks are locked. The week 6 one comes with the week 5 review.
}

const NOTES: Record<number, { heading: string; lines: string[]; callout?: string }> = {
  1: WEEK_5_KICKOFF,
  2: WEEK_5_KICKOFF,
  3: WEEK_5_KICKOFF,
  4: WEEK_5_KICKOFF,
  5: WEEK_5_KICKOFF,
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
