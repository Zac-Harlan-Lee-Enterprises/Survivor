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
    'All five week 12 picks are locked. There are 32 teams in this league and the five of you found three: the Cowboys, the Giants and the Commanders. That is the NFC East, minus the one team in it two of you need to lose. You have all already spent Kansas City, Buffalo, San Francisco and Jacksonville, which is how five grown adults end up trusting the NFC East with their lives. Death read the list twice and asked if I was joking. I pointed out which of us is dead.',
    'Allison and Melanie have each handed their last life to the Dallas Cowboys on Thanksgiving, a sentence that has ruined dinner in better homes than yours. Dallas has scored 91 points in its last two games and given up 76. That isn’t a defense, it’s a suggestion. Dominic and Tracy each lost a life on Dallas in week 5, and the only reason they aren’t standing next to you is that the rules won’t let them make the same mistake twice. Death is coming to dinner. He has asked to carve, and he would like Allison and Melanie seated near the door.',
    'Cindy and Dominic took the Giants at Indianapolis. I see the appeal: the Colts scored 3 points last week, and the only end zone their quarterback reached was his own, flat on his back. But the Giants tied Washington 27–27 in week 5, and here a tie costs a life, so they are a team that can fail to lose and still kill you. Dominic already lost one life in week 4 by not picking anybody at all, so in fairness, choosing the Giants on purpose is progress. Cindy has two lives, so for her this is a pick. For Dominic it is a will.',
    'Tracy is alone on Washington, the other half of that tie, out at Arizona. Arizona has scored 16 points in its last three games; Kansas City had 27 on them by half time last week. So Tracy looked at a league with four people one loss from the grave and picked the game where the other team might not turn up, and not one of you went with her. Either she is the smartest person here or Death has saved her a seat. He won’t say. He just keeps saying “Commanders” and smiling.',
    'Thursday opens with Chicago at Detroit at noon, which Joey and Maya, both rabid Bears fans, will be watching from the graveyard. Then the arithmetic. If Dallas, the Giants and Washington all lose, four of you are dead by Sunday night and Cindy wins the whole league by losing. Death calls that efficient. I call it the most NFC East thing that could possibly happen. He has wound his watch.',
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
