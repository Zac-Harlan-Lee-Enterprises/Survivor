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
 * week 4 is — and the league needs the preview under whichever key it is shown.
 *
 * Week 3 is public, so it may be named. Week 4 picks are hidden until
 * Thursday's kickoff, and this note must not give away who picked what:
 * tests/unit/leagueMessageFacts.test.ts fails if a player is named in the same
 * sentence as their week 4 team, or if the note counts this week's picks.
 */
const WEEK_4_PREVIEW = {
  heading: 'Word from the commissioner',
  lines: [
    'It is Thursday, picks lock at 7:10 tonight, and before anyone does anything they will have to explain later, here is where we stand. Week 3: twenty-four of thirty survived and nobody is out. Eight of you are perfect, fifteen are on two lives, and seven are on one. Seven people on their last life, one week after this league made the most popular pick in its history. Tread carefully.',
    'A brief moment of silence for Joey, a lifelong Bears fan, who picked against the Bears on Monday night and lost a life to them and their thirty-eight-year-old backup quarterback. He is now on one life. We will be bringing this up again.',
    'The game of the week is Kansas City at Las Vegas, two 3–0 teams, and twenty of you are not allowed to touch it: you spent Kansas City last week, all at once, like a lottery win. San Francisco are also 3–0 and host Denver. Buffalo are 3–0 and host New England. Minnesota are 3–0 and host Miami, who have scored thirteen or fewer points in every game this season and whose thermostat, at last check, was set to ten.',
    'Then there is the 0–3 club, which this week has five members and no waiting list: Tennessee visit Baltimore, Houston host Dallas, Tampa Bay host Green Bay, Miami we have covered, and the Chargers visit Seattle. Seven of us spent week 1 on the Chargers, and they have since lost to Arizona, Las Vegas and Buffalo in turn. You cannot fade a team that has already faded.',
    'Scheduling notes. Pittsburgh at Cleveland tonight is the game that locks the week. Indianapolis and Washington play in London at 8:30 on Sunday morning our time, the earliest kickoff this league has seen. Detroit play Sunday night at Carolina and Atlanta play Monday night at New Orleans, for those who prefer to suffer slowly.',
    'And last week’s lesson, for anyone who skipped it: Seattle had won twelve straight, including a Super Bowl, and lost to a backup linebacker. Atlanta had just lost 34–3 and then won 35–14 at Lambeau. The Bears started a thirty-eight-year-old on his eighth team and won by twenty. Nothing is safe. Pick anyway.',
  ],
  // Set apart from the banter, because an instruction buried in jokes is an
  // instruction somebody misses — and seven people are on their last life.
  callout:
    'DM me your week 4 pick on Teams before 7:10 PM tonight, Thursday — five minutes before Pittsburgh at Cleveland kicks off. A missing pick costs a life, and seven of you have exactly one.',
}

const NOTES: Record<number, { heading: string; lines: string[]; callout?: string }> = {
  1: WEEK_4_PREVIEW,
  2: WEEK_4_PREVIEW,
  3: WEEK_4_PREVIEW,
  4: WEEK_4_PREVIEW,
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
