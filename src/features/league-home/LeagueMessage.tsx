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
 */
const WEEK_8_REVIEW: { heading: string; lines: string[]; callout?: string } = {
  heading: 'Word from the late commissioner',
  lines: [
    'Death went nought for five. Every one of you picked a winner, and for the first time this season nobody in the league lost a life — this after weeks of twenty-two, nineteen and ten. He sat through every game with his pencil sharpened and went home with nothing to write. I have never seen him take anything so personally. He straightened the headstones again. There are still twenty-five.',
    'Dominic and Tracy, both on their last life, took Cincinnati at home to Tennessee, who came in 1–6. Last week everyone who had company lost, and the Bengals spent the afternoon trying to keep that streak alive. They fell behind 13–0. They turned it over four times. They trailed 36–29 with under four minutes left. Tee Higgins tied it with 1:17 to go, and Joe Burrow ran it in from nine yards in overtime to win 43–36. Death had his coat on by the fourth quarter. He would like it noted that he is not angry, just disappointed.',
    'Melanie took Jacksonville at home to Indianapolis and was never in any danger: 35–0 in the third quarter, including a 92-yard interception return with ten seconds left in the half, and 42–7 at the end, the biggest win of the week. Death left at halftime. He doesn’t do blowouts; he is a professional.',
    'Cindy took the Rams — the same Rams who cost thirteen of us a life in week 6 — against the Chargers, who came in 0–6. The Chargers kicked three field goals, led 9–3, and never scored again; the Rams won 24–9. Cindy is still the only one of you on two lives. The Chargers are now 0–7. I picked them in week 1. In my defence, they were 0–0 at the time.',
    'Allison took Green Bay at home to Carolina on Thursday night and won 27–19. Green Bay missed an extra point in the first quarter, and Carolina scored a touchdown with 5:37 left, but the two-point try failed, and Death, who had sat up for it, went to bed. She then spent the weekend watching the rest of you sweat.',
    'Minnesota, 6–0 and the last unbeaten team in football, lost 19–15 at Detroit on a touchdown with 4:35 left. Last week I said Death had promised to sit on his hands. He insists he did. There are no unbeaten teams left, which Death says is how it should be.',
    'Nobody picked Chicago at Seattle, so the week was settled before Monday night kicked off. The Bears came into it 5–2, unbeaten since the weekend Joey was buried. Death says correlation is not causation, and then he winks.',
    'Week 9: Pittsburgh and Tennessee are on bye. Thursday night is Jacksonville at Baltimore, which locks the week, and Melanie can’t have the Jaguars twice. Five of you, four on your last life. Death has cleared his diary again. He says he is an optimist.',
  ],
  // Set apart from the banter, because an instruction buried in jokes is an
  // instruction somebody misses — and four of the five are on their last life.
  callout:
    'DM me your week 9 pick on Teams before 7:10 PM Thursday, November 5 — five minutes before Jacksonville at Baltimore kicks off. Four of you are on your last life, and a missing pick costs a life.',
}

export function LeagueMessage({ week }: { week: number }) {
  if (week < 1 || week > 9) return null
  const note = WEEK_8_REVIEW

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
