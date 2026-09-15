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
 * Every number below is from the real week 1 result, checked against the ESPN
 * scoreboard and contemporary reports — a made-up stat in a note addressed to
 * the whole league would be found out by Sunday lunchtime.
 */

/**
 * Mapped to both weeks on purpose: week 1 is not final until Monday night's
 * game is synced, so keying this to week 2 alone would leave the league reading
 * a preview of games that had already been played.
 */
const WEEK_1_REVIEW = {
  heading: 'Word from the commissioner',
  lines: [
    'Seven of you called the Jaguars a lock, this column called that famous last words, and Trevor Lawrence answered with four touchdowns and a 24–0 lead by halftime. Noted. Filed. Never to be spoken of again.',
    'The six on the Chargers lost at home to Jacoby Brissett, a career journeyman who has changed jerseys more often than most of you have changed jobs. Arizona held the ball for thirty-seven minutes while the Chargers offence watched like it had bought a ticket. Your commissioner was one of the six, so understand that this paragraph is being typed through tears.',
    'Detroit’s six went up 21–0 and then spent two hours learning what a panic attack feels like, surviving 31–30 only because New Orleans went for two in overtime and threw it approximately nowhere.',
    'We did wonder whether Joanna on the Cowboys and Matt on the Packers were the two sharpest minds in the league or the only two who had not read the group chat. The Giants and the Vikings have reviewed the evidence and returned a verdict.',
    'Twenty-one of you are unscathed, eight are limping, and nobody is out. The four on Seattle came through the lowest-scoring game of the week — 13–10, which they are calling defensive football and the rest of us are calling a nap.',
  ],
  // Deliberately not one of the jokes: this is the bit people must not skim.
  callout:
    'DM me your week 2 pick on Teams before Thursday’s kickoff. Picks lock at 7:10 PM Thursday, five minutes before Detroit at Buffalo — and a missing pick costs a life, which is the one rule I cannot bend for you.',
}

const NOTES: Record<number, { heading: string; lines: string[]; callout?: string }> = {
  1: WEEK_1_REVIEW,
  2: WEEK_1_REVIEW,
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
