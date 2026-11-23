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
    'Death went nought for five again. That is four weeks running without a funeral and twenty winning picks in a row, and there are still twenty-five headstones. Death has started giving tours of the graveyard himself, mostly to have somebody to talk to. Attendance is poor. He says the dance is coming along.',
    'Allison took Houston at home to Indianapolis on Thursday night and won 26–3. The Colts kicked a field goal in the first quarter and never scored again, and in the third Will Anderson Jr. sacked Daniel Jones in his own end zone for a safety, so the Colts scored three points and handed Houston two. Allison lost a life on the Colts in week 6. Houston is the team that cost Cindy and Melanie a life in week 7. Death calls this closure. He says he would know.',
    'Cindy, Dominic and Tracy all took Buffalo at home to Miami and won 26–9. Josh Allen threw two interceptions and it made no difference: Tyler Bass kicked four field goals, Miami’s quarterback completed 12 of 33 passes for 102 yards, and all nine of Miami’s points were field goals. Miami is 1–9. So is Tennessee. Each has won exactly one game all season, and each of those wins buried somebody in this league: Tennessee’s took Chloe, Corey and Joanna in week 6, and Miami’s took Dave in week 7. Death sends them both a fruit basket at Christmas.',
    'Melanie took Kansas City at home to Arizona and won 34–7. Patrick Mahomes threw three touchdowns, two of them to Travis Kelce, and it was 27–7 at half time. Melanie has now lived through three straight weeks on the Bears with no time left on the clock, then the Bills, then the Chiefs. Death says that is not so much a strategy as a getaway.',
    'A correction. Last week I told you the Chargers were 0–8. That night they won 23–20 at Baltimore. On Sunday they lost 27–24 to the Jets. Death says it is the shortest resurrection he has ever seen, and he has seen all of them.',
    'Jacksonville, which carried three of you last week, lost 23–18 at the Giants this week. Death says timing is everything; he has never missed an appointment in his life, or in anybody else’s. Dallas scored 51 against Tennessee, which the twenty-one of you who lost with Dallas in week 5 are welcome to take personally.',
    'Nobody picked Cincinnati at Washington on Monday night, so the week was settled on Sunday. All five of you spent Cincinnati weeks ago. Death will watch anyway; he likes to see how the other half lives.',
    'Week 12 is Thanksgiving, and it starts the day before: the first game is Green Bay at the Rams on Wednesday night, so the week locks on Wednesday, not Thursday. Thursday is Chicago at Detroit, Philadelphia at Dallas, and Kansas City at Buffalo, and all five of you have already used both Kansas City and Buffalo, so the best game of the holiday is the one none of you can touch. Nobody is on bye. Five of you, four on your last life, Cindy on two. Death has gone four weeks without a customer. He has been asked to carve the turkey at four separate dinners; he says it is the only work he can get.',
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
