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
 * Shown for weeks 1–8: the seed carries no results, so the engine calls week 1
 * current until the live sync lands them, at which point week 8 is.
 *
 * Written after the week 8 lock, before the week's results: it never says
 * what anyone picked, and it is built only from league data.
 */
const WEEK_8_PREVIEW: { heading: string; lines: string[]; callout?: string } = {
  heading: 'Word from the late commissioner',
  lines: [
    'Death is in a mood. For the first time since week 5, every one of you still standing got a pick in, so there was nobody for him to collect by default. He had cleared his whole Thursday for it. He spent it straightening headstones instead. There are twenty-five of them now, and he did every one twice.',
    'The field: five of you. Four on your last life, and Cindy on two, which in this cemetery counts as old money. Last week everyone who had company lost a life, and the most popular pick has now lost three weeks running, zero for forty. Death would like to thank the group chat for its service.',
    'Houston, who buried four of you last week, have the week off, along with New Orleans, the Giants and San Francisco. Death is sending Houston a fruit basket.',
    'Thursday night, Carolina at Green Bay locked the week. On Sunday, Minnesota take the league’s last unbeaten record, 6–0, into Detroit. Death has a seat on the fifty-yard line and has promised to sit on his hands.',
    'Monday night the Bears, 5–2, play in Seattle. Joey was buried in week 5, the same weekend the Bears lost 31–7 at Green Bay, and they haven’t lost since. Draw your own conclusions. Death has drawn his.',
    'I’ll be back after Monday night with the damage. Until then, Death asks that you stop refreshing the scoreboard. It doesn’t help, and he can hear it.',
  ],
  // Set apart from the banter, because an instruction buried in jokes is an
  // instruction somebody misses.
  callout:
    'Week 9: DM me your pick on Teams before 7:10 PM Thursday, November 5. A missing pick still costs a life.',
}

export function LeagueMessage({ week }: { week: number }) {
  if (week < 1 || week > 8) return null
  const note = WEEK_8_PREVIEW

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
