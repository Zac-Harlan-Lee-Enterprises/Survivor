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
 * Shown for weeks 1–11: the seed carries no results, so the engine calls week 1
 * current until the live sync lands them, at which point week 11 is.
 *
 * Written after Sunday night's game settled week 10 (Monday night's Chargers at
 * Baltimore had no picks), before any week 11 pick: it names no week 11 pick.
 */
const WEEK_10_REVIEW: { heading: string; lines: string[]; callout?: string } = {
  heading: 'Word from the late commissioner',
  lines: [
    'Death went nought for five again. That is three weeks running without a funeral and fifteen winning picks in a row; before week 8 this league had never once gone a week without losing a life. There are still twenty-five headstones. Death has had so much time on his hands that he has taken up dancing. He has a straw hat now, and a routine, and he would like it known that he is very good. He has also had his jacket taken in across the chest. I asked him to. Don’t ask why.',
    'Dominic, Tracy and Allison all took Jacksonville at Tennessee, and the Jaguars won 40–23 and kept the ball for 38 minutes. Tennessee is 1–8. Its one win all season came in week 6, on the afternoon Chloe, Corey and Joanna were buried, so Tennessee has now knocked three of you out of this league and beaten one football team. Joey Slye, the kicker whose four field goals did the burying that day, kicked three from 50 yards or more on Sunday. It made no difference. Death says he admires a man who keeps turning up for work after the work has gone.',
    'Cindy took Seattle at Las Vegas, whose quarterback is Fernando Mendoza. Seattle sacked him six times, the Raiders gained 163 yards all afternoon, and Seattle won 21–13. So a Mendoza beat a Mendoza. Death says he has been to a great many family reunions, and that is usually how they end. Cindy has now picked a winner in nine of her ten weeks and is still the only one of you on two lives.',
    'Melanie took Buffalo at the Jets and won 31–12. The Jets played two quarterbacks, got into the red zone twice, came away with nothing either time, and scored all twelve of their points on Jason Sanders field goals. They are 2–8. You will remember the Jets as the team that cost Allison a life and buried Dave in week 7, the day Miami won its first game. On Sunday they finally did something for one of you: they lost.',
    'Here is your problem. The two best teams in football, San Francisco and Buffalo, are 8–1, and all five of you have used San Francisco. Jacksonville and Cincinnati are 7–2, and all five of you have used both of them too. Death has started reading the standings over breakfast. He says it relaxes him.',
    'Nobody picked San Francisco at Dallas, which finished 46–40: eighty-six points, and Death watched every one of them with his feet up. Dallas, the team twenty-one of you lost with in week 5, lost again. Death sends them flowers every week as a professional courtesy.',
    'Nobody picked the Chargers at Baltimore on Monday night either, so the week was settled on Sunday. The Chargers are 0–8. Seven of you took them in week 1. Death keeps a photograph of that weekend on his desk, and he says you all look very happy in it.',
    'Week 11: Atlanta, Cleveland, Green Bay, the Rams, New England and Seattle are on bye, so Cindy spent Seattle at exactly the right moment. Thursday night is Indianapolis at Houston, which locks the week. Houston is the team six of you took in week 7 and lost with, 27–21 in overtime; Cindy and Melanie are the only two of those six still alive, and neither can have Houston again. Five of you, four on your last life, Cindy on two. Death has gone three weeks without a customer. He has bought a second hat.',
  ],
  // Set apart from the banter, because an instruction buried in jokes is an
  // instruction somebody misses, and four of the five are on their last life.
  callout:
    'DM me your week 11 pick on Teams before 7:10 PM Thursday, November 19, five minutes before Indianapolis at Houston kicks off. Four of you are on your last life, and a missing pick costs a life.',
}

export function LeagueMessage({ week }: { week: number }) {
  if (week < 1 || week > 11) return null
  const note = WEEK_10_REVIEW

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
