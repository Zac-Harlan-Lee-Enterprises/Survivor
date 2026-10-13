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
 * Mapped to weeks 1 through 6 on purpose. The seed carries no results, so the
 * engine calls week 1 current until the live sync lands them, at which point
 * week 6 is — and the league needs the review under whichever key it is shown.
 *
 * Week 5 is public, so the review names picks. It says nothing about week 6
 * picks, which are hidden until Thursday.
 */
const WEEK_5_REVIEW = {
  heading: 'Word from the commissioner',
  lines: [
    'Twenty-one of you rode Dallas on Thursday night. Tampa Bay, 0–4 and starting a rookie quarterback in his second game, won 24–16, and every one of the twenty-one lost a life. Not most. All. Bucky Irving ran for 165 yards, Dak Prescott threw two interceptions — the last off a tipped pass in the final two minutes — and KaVontae Turpin fumbled a kickoff, for completeness. Last week I wrote that if the Bucs won their first game of the season the crow would need a bigger stone. The crow needed five.',
    'Craig, Jared, Joey, Nate and Phyllis are out. With Don, that is six graves, and the graveyard on this page now has more going on than the Tennessee offense. Their epitaphs are on their profiles; read them, they earned every word. Joey went out on the same weekend the Bears lost 31–7 at Green Bay, so for the first time all season, Joey and his Bears suffered together.',
    'Then there is Paul, who did not lose. Washington did not lose. Washington tied the Giants 27–27, and a tie costs a life exactly like a loss — it is in the rules, I checked, twice. The Giants’ kicker missed three field goals; with twelve seconds left in overtime at the Giants’ 24, Jayden Daniels scrambled, was sacked for no gain, and Washington had no timeouts. Nobody wanted to win that game, and Paul paid for both of them.',
    'Elsewhere, sanity. Cindy, Dave, Melanie and Allison survived Cincinnati 31–24 — Miami scored twenty-four, nearly double its previous season high, and still lost, which is the most Miami thing that has happened all year. Joanna and Corey took Houston, who won their first game of the season 26–3; Tennessee kicked a field goal on the opening drive and did nothing else for three quarters. And Tina took New England, who beat the Raiders 45–17 behind 374 yards from Drake Maye. If you can’t beat them, pick them. It worked.',
    'Where we stand: twenty-four alive, six in the ground. Allison and Cindy are the only two still holding all three lives — both rode Cincinnati, and neither has lost a pick all season. Seven of you are on two lives, and fifteen of you are on your last. Fifteen people, one bad Sunday each from a headstone, and the crow can count.',
    'Week 6 has four teams on bye: Cincinnati, Miami, Detroit and Minnesota. Thursday night is Seattle at Denver, which locks the week. Houston and Jacksonville play in London at 8:30 on Sunday morning our time — the Texans, fresh from their first win, against a Jacksonville side that is 4–1. And Dallas visit Green Bay on Sunday night, which twenty-one of you can now watch with nothing riding on it: the healthiest way to watch the Cowboys there is.',
  ],
  // Set apart from the banter, because an instruction buried in jokes is an
  // instruction somebody misses — and fifteen people are on their last life.
  callout:
    'DM me your week 6 pick on Teams before 7:10 PM Thursday — five minutes before Seattle at Denver kicks off. A missing pick costs a life, and fifteen of you have exactly one.',
}

const NOTES: Record<number, { heading: string; lines: string[]; callout?: string }> = {
  1: WEEK_5_REVIEW,
  2: WEEK_5_REVIEW,
  3: WEEK_5_REVIEW,
  4: WEEK_5_REVIEW,
  5: WEEK_5_REVIEW,
  6: WEEK_5_REVIEW,
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
