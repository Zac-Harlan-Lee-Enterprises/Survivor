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
 * Shown for weeks 1–10: the seed carries no results, so the engine calls week 1
 * current until the live sync lands them, at which point week 10 is.
 *
 * Written after Sunday night's game settled week 9 (Monday night's Buffalo at
 * Minnesota had no picks), before any week 10 pick: it names no week 10 pick.
 */
const WEEK_9_REVIEW: { heading: string; lines: string[]; callout?: string } = {
  heading: 'Word from the late commissioner',
  lines: [
    'Death went nought for five again. For the second week running nobody in the league lost a life; before last week it had not happened once all season. That is ten picks in a row he has watched without burying anybody. He has started turning the lights off in the graveyard to save on electricity. There are still twenty-five headstones.',
    'Dominic and Melanie, both on their last life, took the Bears at home to Tampa Bay on Sunday night, and the Bears did everything they could to bury them. Caleb Williams threw four interceptions. The Bears turned it over five times. They led by eight with under four minutes left, fumbled it away at their own 21, and Tampa Bay scored and ran in the two-point conversion to tie it at 24 with 2:51 to go. Then Cairo Santos kicked a 38-yard field goal with no time left on the clock, and the Bears won 27–24. Death had the shovel in his hand. He has put it back, but he hasn’t cleaned it.',
    'The league has two Bears fans, Joey and Maya. Between them they made twelve picks this season and never once took the Bears; Joey even picked against them in week 3, and lost. Both are now in the graveyard. Dominic and Melanie, who owe the Bears nothing, took them once and lived. Death says there is a lesson in that, and Joey and Maya are not going to like it.',
    'The Bears have now won four straight, every game since they lost 31–7 at Green Bay the weekend Joey was buried. They won the week Maya went in, too, and both games since. Death says he is not saying the two things are connected. He is just saying both Bears fans are in the graveyard and the Bears have stopped losing.',
    'Cindy and Tracy took Detroit at Miami, and Detroit won 19–9 in a game with one touchdown in it. Jake Bates kicked four field goals from four tries and scored thirteen points, which means he beat the Dolphins on his own. Miami never found the end zone. Death watched the whole thing and says it was the most peaceful afternoon he has had in years; he would like it played at his own funeral. Cindy has now picked a winner in eight of her nine weeks and is still the only one of you on two lives.',
    'Allison took San Francisco at home to Las Vegas and won 38–17. The Raiders turned it over five times, and seventeen seconds into the second half Jaden Dugger intercepted Kirk Cousins and ran it back 35 yards for a touchdown. The 49ers are 7–1. Death says watching the Raiders was like watching a man try to pay for his groceries with a library card. He means it kindly.',
    'Cincinnati, whom every one of you has already used, won 34–17 at Atlanta at 8:30 in the morning. Death ate his croissant and felt nothing, which he says is how he likes his football.',
    'Nobody picked Buffalo at Minnesota, so the week was settled when the Bears’ game ended. Death will watch Monday night anyway. He says he likes to keep his hand in.',
    'Week 10: Chicago, Denver, Philadelphia and Tampa Bay are on bye, so the Bears can’t save anybody this time. Thursday night is Washington at the Giants, which locks the week, and Sunday starts at 8:30 in the morning again, with New England at Detroit; Cindy and Tracy can’t have the Lions twice. Five of you, four on your last life, Cindy on two. Death has gone two weeks without a customer. He says he isn’t worried. He says he has been doing this for a very long time.',
  ],
  // Set apart from the banter, because an instruction buried in jokes is an
  // instruction somebody misses, and four of the five are on their last life.
  callout:
    'DM me your week 10 pick on Teams before 7:10 PM Thursday, November 12, five minutes before Washington at the Giants kicks off. Four of you are on your last life, and a missing pick costs a life.',
}

export function LeagueMessage({ week }: { week: number }) {
  if (week < 1 || week > 10) return null
  const note = WEEK_9_REVIEW

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
