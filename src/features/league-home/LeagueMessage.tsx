import { Megaphone, Send } from 'lucide-react'

/**
 * The commissioner's note to the league, between the scoreboard and the
 * standings. He was buried in week 6, so it comes from the late commissioner,
 * with Death in the room: the voice the league liked best (the message from
 * beyond, week 7).
 *
 * Every number and result in it is checked against the season in
 * tests/unit/leagueMessageFacts.test.ts. Death's habits are the only fiction.
 *
 * Shown for weeks 1–12: the seed carries no results, so the engine calls week 1
 * current until the live sync lands them, at which point week 12 is.
 *
 * Written after Sunday night's game settled week 11 (Monday night's Cincinnati
 * at Washington had no picks), before any week 12 pick: it names no week 12 pick.
 */
const WEEK_11_REVIEW: { heading: string; lines: string[]; callout?: string } = {
  heading: 'Word from the late commissioner',
  lines: [
    'Five picks, five winners, again. That is twenty in a row, and four straight weeks without anyone losing a life, in a league where somebody had lost one every single week before that. Death says he hasn’t had a month this quiet since penicillin. He has filled the time learning a kick-line with a cane and a straw boater, and I’m the one who has to live with him. So to speak.',
    'Allison took Houston over the Colts, the team that cost her a life in week 6. Houston won 26–3. To be fair to Colts quarterback Daniel Jones, he did reach an end zone: it was his own, and Will Anderson Jr. sacked him in it for a safety. Death watched that one twice. He says it’s rare to see a man dig the hole, climb in, and wait.',
    'Cindy, Dominic and Tracy all piled onto Buffalo, who beat Miami 26–9. Bills kicker Tyler Bass scored 14 points. Miami, an entire football team, scored 9. Their quarterback, Kyle McCord, threw 33 passes for 102 yards, which is about three yards a throw. Death says he has seen men gain more by fainting.',
    'Melanie is on her last life, and two weeks ago she handed it to the Bears, whose quarterback threw four interceptions before a field goal saved her with no time left. This week she took Kansas City, who led 27–7 at half time and won 34–7. Death left at half time. He says he has never walked out on her before. He sat through all four of those interceptions with the shovel on his lap.',
    'Miami is 1–9. So is Tennessee. That is two wins all season between the pair of them, and those two wins buried Dave, Chloe, Corey and Joanna. Death wants it known there is no shame in being hit by a bus. He just notes that those four were hit by a parked one.',
    'Now, Thanksgiving. Picks lock Wednesday, not Thursday: Green Bay at the Rams kicks off Wednesday night at 7:00 Central, so the door shuts at 6:55 PM on November 25. Miss it and it costs you a life, same as a loss. Death asked me not to mention any of this. He has four of you on your last life and a month with nothing to do, and he was rather hoping you’d all assume Thursday.',
  ],
  // Set apart from the banter, because an instruction buried in jokes is an
  // instruction somebody misses, and four of the five are on their last life.
  callout:
    'DM me your week 12 pick on Teams before 6:55 PM Wednesday, November 25, five minutes before Green Bay at the Rams kicks off. That is a day sooner than usual, because of Thanksgiving. Four of you are on your last life, and a missing pick costs a life.',
}

export function LeagueMessage({ week }: { week: number }) {
  if (week < 1 || week > 12) return null
  const note = WEEK_11_REVIEW

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
      {/* Set apart on purpose: an instruction buried in a joke is an
          instruction somebody misses, and missing costs a life. */}
      {note.callout && (
        <p className="mt-4 flex max-w-3xl items-start gap-3 rounded-xl border border-gold-400/40 bg-gold-400/10 p-4 font-medium text-ink-100">
          <Send className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" aria-hidden="true" />
          <span>{note.callout}</span>
        </p>
      )}
    </section>
  )
}
