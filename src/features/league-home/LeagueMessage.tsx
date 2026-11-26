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
 * Written once the week 12 picks locked (6:55 PM Wednesday, November 25): from
 * then the app shows everyone's pick, so the note talks about them. Before a
 * lock it never names a pick.
 */
const WEEK_12_PICKS: { heading: string; lines: string[]; callout?: string } = {
  heading: 'Word from the late commissioner',
  lines: [
    'All five week 12 picks are in and locked, and you have put the whole league on three teams: the Cowboys, the Giants and the Commanders. Death read the list twice and asked if I was joking. I pointed out which of us is dead.',
    'Allison and Melanie have each put their last life on Dallas, at home to Philadelphia at 3:30 on Thanksgiving. Dallas has scored 91 points in its last two games and given up 76, so anything could happen and probably will. Dominic and Tracy know the feeling: Dallas is where each of them lost a life in week 5. Death is coming to dinner on Thursday. He has asked to carve, and to sit where he can see the television.',
    'Cindy and Dominic took the Giants at Indianapolis on Sunday. The Colts lost 26–3 last week and their quarterback was sacked in his own end zone, so I see the appeal. But the Giants have already played one tie this season, 27–27 at Washington in week 5, and a tie costs a life here. Cindy has two lives. Dominic has one, which makes it the same pick at two very different prices.',
    'Tracy is alone on Washington, the other half of that tie, at Arizona on Sunday afternoon. Arizona has scored 16 points in its last three games. Kansas City had more than that against them by half time last week. Death says nobody is ever truly alone, and then he looked at Tracy for rather a long time.',
    'Here is the arithmetic. Four of you are on your last life. If Dallas, the Giants and Washington all lose, Cindy loses a life and wins the league in the same week. Death calls that efficient. He has wound his watch.',
  ],
  // Set apart from the banter, because an instruction buried in jokes is an
  // instruction somebody misses, and four of the five are on their last life.
  callout:
    'Week 12 picks are locked. Week 13: DM me your pick on Teams before 7:10 PM Thursday, December 3. A missing pick still costs a life.',
}

export function LeagueMessage({ week }: { week: number }) {
  if (week < 1 || week > 12) return null
  const note = WEEK_12_PICKS

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
