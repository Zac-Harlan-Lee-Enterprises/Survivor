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
 * Written after the week 8 lock, before a ball was kicked: it says who got a
 * pick in and when, never what anyone picked.
 */
const WEEK_8_PREVIEW = {
  heading: 'Word from the late commissioner',
  lines: [
    'All five week 8 picks are in, and Death has taken it personally. Tracy sent hers at 12:14 on Wednesday afternoon. Allison sent hers at 5:39 on Thursday, an hour and a half before the lock.',
    'It is the first week since week 5 that everyone still standing sent a pick. Wesley sent nothing in weeks 6 and 7, and he is now in no position to argue about it. Death says he misses the no-shows: they never make him wait for the late game.',
    'The field: five of you, with twenty-five headstones behind you. Four of you are on your last life. Cindy is on two, which in this cemetery counts as old money. The most popular pick has lost three weeks running and is zero for forty, and last week everyone who had company lost a life. Death isn’t saying whether anyone has company this week. He just keeps smiling at the standings, which he has never done before and which I would ask him to stop.',
    'Thursday’s Carolina at Green Bay locked the week; the Panthers came in 3–3 and the Packers 4–3. On Sunday, Minnesota take the league’s only unbeaten record, 6–0, to Detroit. Houston, New Orleans, the Giants and San Francisco are on bye, so Death can’t reach anyone through them, and he has checked.',
    'Monday night the Bears, 5–2, play in Seattle. Joey was buried in week 5, the same weekend the Bears lost 31–7 at Green Bay, and they haven’t lost since. Draw your own conclusions. Death has drawn his.',
    'I’ll be back after Monday night with the damage. Death would like you to know the cemetery has plenty of room, and that he has been told he is very good with people.',
  ],
  // Set apart from the banter, because an instruction buried in jokes is an
  // instruction somebody misses.
  callout:
    'All five week 8 picks are locked. Week 9: DM me your pick on Teams before 7:10 PM Thursday, November 5. A missing pick still costs a life.',
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
      <p className="mt-4 flex max-w-3xl items-start gap-3 rounded-xl border border-gold-400/40 bg-gold-400/10 p-4 font-medium text-ink-100">
        <Send className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" aria-hidden="true" />
        <span>{note.callout}</span>
      </p>
    </section>
  )
}
