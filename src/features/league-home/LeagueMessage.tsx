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
 * seeded season and the real cached schedule, and the week 1 results are the
 * ones this column already reported. A made-up stat in a note addressed to the
 * whole league would be found out by Sunday lunchtime.
 */

/**
 * Mapped to both weeks on purpose. Week 1 has no recorded result, so the engine
 * still calls it the current week, but every week 1 game has been played and
 * week 2 locks on Thursday — so the league needs the preview under either key.
 */
const WEEK_2_PREVIEW = {
  heading: 'Word from the commissioner',
  lines: [
    'Week 2 has no byes. All thirty-two teams are available, which is the widest menu this league will ever be handed. Eleven of you looked at that menu, considered every option, and independently ordered San Francisco. Eleven. That is not a consensus. That is a group chat.',
    'Here is the fixture I will be watching. Seven of you are on Tampa Bay. Tony is on Cleveland. Cleveland play at Tampa Bay, Sunday at noon. Eight of you are in the same football game on opposite sides, and by about three o’clock one of those positions will look like genius and the other will be explaining itself in the group chat.',
    'Joanna, Allison and Phyllis are on Buffalo, so their week is decided before most of you have finished dinner. Worth noting that Allison’s week 1 pick was Detroit, who kept her alive by surviving 31–30 in overtime, and she has repaid them by backing the team trying to ruin their Thursday. Cold. Possibly correct. Still cold.',
    'Twenty-five of the twenty-seven picks in so far are on home teams. The only two of you willing to leave the house are Melanie, who has Philadelphia at Tennessee, and Tony, whose situation we have already covered. Melanie is the one person here who looked at a road game and felt fine about it.',
    'Joanna and Matt were the two who went off-script in week 1 — the Cowboys and the Packers — and were punished for it in full view of everyone. Both have now rejoined the herd, Joanna on Buffalo and Matt on San Francisco. One week. That is all it took.',
    'The graveyard of spent teams is filling nicely: Jacksonville gone for seven of you, Detroit and the Chargers for six apiece, Seattle for four. Bradley has now burned Detroit and Chicago in consecutive weeks, working down the NFC North like a man reading a menu top to bottom. And your commissioner, one of the six buried by the Chargers, has joined the San Francisco pile — which should tell you exactly how much I learned.',
  ],
  // Deliberately not one of the jokes: this is the bit people must not skim.
  callout:
    'Jared and Tina — I still do not have your pick. DM me your week 2 pick on Teams. Picks lock at 7:10 PM Thursday, five minutes before Detroit at Buffalo, and a missing pick costs a life, which is the one rule I cannot bend for you.',
}

const NOTES: Record<number, { heading: string; lines: string[]; callout?: string }> = {
  1: WEEK_2_PREVIEW,
  2: WEEK_2_PREVIEW,
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
