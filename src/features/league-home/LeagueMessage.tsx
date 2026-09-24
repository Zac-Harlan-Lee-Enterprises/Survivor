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
 * Mapped to weeks 1 through 3 on purpose. The seed carries no results, so the
 * engine still calls week 1 current until the live sync lands them, at which
 * point week 3 is — and the league needs the preview under whichever key it is
 * shown.
 */
const WEEK_3_PREVIEW = {
  heading: 'Word from the commissioner',
  // Nothing here may reveal this week's choices: they stay hidden until the
  // week's first kickoff, and a preview that leaks them undoes the deadline.
  // tests/unit/leagueMessageFacts.test.ts fails if a player's name appears.
  lines: [
    'Week 3 locks at 7:10 tonight. Three of you found out last week exactly what a missing pick costs, so I will say this once up here and again at the bottom in a box, like a man who has learned something.',
    'The menu. Kansas City are 2–0 and visit Miami, who have scored exactly thirteen points in each of their two games. That is not a slump, that is a thermostat. The Chiefs have also acquired Kenneth Walker, who was the MVP of the last Super Bowl — which he won with Seattle, who are now 2–0 and defending champions and visit Washington. Washington are 0–2 and have not yet played at home; this is their home opener. Nothing says housewarming like the champions turning up.',
    'The Chargers visit Buffalo. The Chargers have lost 26–14 in each of their first two games, the same score twice, which is not a losing streak so much as a subscription. Buffalo scored forty-one in the first game at their new stadium. Seven of you used the Chargers in week 1 and have been paying for it ever since.',
    'Thursday night is Atlanta at Green Bay. Atlanta lost 34–3 at home to Carolina on Sunday. Green Bay beat the Jets by three. I am not allowed to make your picks for you. I am allowed to raise an eyebrow, and it is raised.',
    'A small reminder for the eleven of you who rode San Francisco last week, the seven on Tampa Bay, and everyone else: you cannot use them again. The menu gets shorter every Sunday. Plan accordingly, or at least plan.',
  ],
  // Set apart from the banter, because an instruction buried in jokes is an
  // instruction somebody misses — and last week three people did.
  callout:
    'DM me your week 3 pick on Teams before 7:10 PM tonight, Thursday — five minutes before Atlanta at Green Bay kicks off. A missing pick costs a life, and some of you do not have one to spare.',
}

const NOTES: Record<number, { heading: string; lines: string[]; callout?: string }> = {
  1: WEEK_3_PREVIEW,
  2: WEEK_3_PREVIEW,
  3: WEEK_3_PREVIEW,
}

export function LeagueMessage({ week }: { week: number }) {
  const note = NOTES[week]
  if (!note) return null

  return (
    <section
      className="card border-sky-400/25 p-5 md:p-6"
      aria-labelledby="league-message-title"
    >
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
