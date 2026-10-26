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
 */
const WEEK_7_REVIEW = {
  heading: 'Word from the late commissioner',
  lines: [
    'Last week Death asked whether we offer a group rate. This week six of you took Houston at home to the Giants, and he got one. The Texans tied it 21–21 with fifty-two seconds left — exactly long enough for six people to start breathing again — and then lost 27–21 in overtime on a thirty-yard run. Death watched overtime standing up. I have never seen him stand up for anything.',
    'Dave and Allison took the Jets at home to Miami. Before Sunday, fifty-one of this league’s picks had gone against the Dolphins, and all fifty-one had won; Miami were the closest thing we had to a life insurance policy. On Sunday they won their first game of the season, 28–25, against the only two of us who picked against them. Death says he has been waiting on that policy to lapse since September.',
    'Jason went alone with Carolina and lost 43–13 to Tampa Bay. Carolina turned it over four times, and when they finally scored a touchdown, Tampa Bay blocked the extra point, ran it back, and were given two points for it. That is not a football game; that is a mugging with a scoreboard. And Wesley sent no pick, for the second week running. Death says he didn’t take Wesley so much as notice he’d already gone.',
    'The official count: seven of you were knocked out this week. Bradley, Maya, Mike and Shahid went down with Houston, Dave with the Jets, Jason with Carolina, and Wesley with nothing at all. That makes twenty-five headstones and five of you still standing. Every single one of you who had company this week lost a life, and the only two who came through clean went alone. The most popular pick has now lost three weeks running — Dallas, the Rams, Houston — and is zero for forty. If you find yourself agreeing with the group chat on Thursday, Death would like you to know he’s free.',
    'The five. Cindy lost her first life of the season — six straight wins, then Houston — and is still the only one of you on two. Allison and Melanie are down to their last. Dominic went alone with Minnesota and won 16–10, and the Vikings are now 6–0, the last unbeaten team, because San Francisco lost at Atlanta and Kansas City managed three points in Seattle. Tracy went alone with Denver and won 30–16 in Arizona.',
    'Nobody picked Dallas at Philadelphia, so the week was settled before Monday night kicked off. Death has the evening off. He is spending it behind my chair, which is how he relaxes.',
    'Week 8: Houston, New Orleans, the Giants and San Francisco are on bye. Thursday night is Carolina at Green Bay, which locks the week. Minnesota, 6–0, go to Detroit, and of the five of you left, only Allison can still pick them. Five of you. Death says take your time; he’s paid by the hour.',
  ],
  // Set apart from the banter, because an instruction buried in jokes is an
  // instruction somebody misses — and four of the five are on their last life.
  callout:
    'DM me your week 8 pick on Teams before 7:10 PM Thursday — five minutes before Carolina at Green Bay kicks off. Four of you are on your last life, and a missing pick costs a life. Ask Wesley.',
}

export function LeagueMessage({ week }: { week: number }) {
  if (week < 1 || week > 8) return null
  const note = WEEK_7_REVIEW

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
