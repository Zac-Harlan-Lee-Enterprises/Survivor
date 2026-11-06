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
 * Shown for weeks 1–9: the seed carries no results, so the engine calls week 1
 * current until the live sync lands them, at which point week 9 is.
 *
 * Written after the week 9 lock, before the week's results: it names no team
 * anyone picked this week, and it is built only from league data.
 */
const WEEK_9_PREVIEW: { heading: string; lines: string[]; callout?: string } = {
  heading: 'Word from the late commissioner',
  lines: [
    'Death has had a difficult week. Last week nobody lost a life, for the first time all season, and he has spent the days since rereading the rules for a loophole. There isn’t one. He has checked twice, and once more with a magnifying glass.',
    'All five week 9 picks are in, which means this league has gone two weeks running without a missing pick for the first time all season. Death says he liked you better when you were disorganised.',
    'The field hasn’t moved: five of you, four on your last life, and Cindy on two. She has picked a winner in seven of her eight weeks. Death would like to know how she does it, and frankly, so would I.',
    'Thursday’s Jacksonville at Baltimore locked the week. Sunday starts at 8:30 in the morning, our time, with Cincinnati at Atlanta, and every one of you has already used the Bengals, so for once Death can watch them with no conflict of interest. He is bringing a croissant.',
    'Pittsburgh and Tennessee are on bye. Tennessee came in 1–6 last week and still took Cincinnati to overtime; Death says it’s a shame to rest talent like that.',
    'Monday night is Buffalo at Minnesota, now 6–1 after losing their unbeaten record last week. Death says he loves a Monday. He is the only one who does.',
    'I’ll be back after the games with the damage. Death has asked me to tell you he isn’t superstitious, and then he touched every headstone on his way out. There are still twenty-five.',
  ],
  // Set apart from the banter, because an instruction buried in jokes is an
  // instruction somebody misses.
  callout:
    'All five week 9 picks are locked. Week 10: DM me your pick on Teams before 7:10 PM Thursday, November 12. A missing pick still costs a life.',
}

export function LeagueMessage({ week }: { week: number }) {
  if (week < 1 || week > 9) return null
  const note = WEEK_9_PREVIEW

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
