import { Megaphone, Send } from 'lucide-react'

/**
 * The commissioner's note to the league, between the scoreboard and the
 * standings.
 *
 * The copy is editorial and lives here on purpose: it is written for one moment
 * in the season, not derived from the data. `week` gates it, so when the league
 * moves on and nobody has written the next one, the section simply is not
 * there rather than shouting about a week gone by.
 *
 * Every number below is checked: the pick counts and matchups come from the
 * seeded season and the real cached schedule, and the results are the ones on
 * the ESPN scoreboard and in the game recaps, pinned in
 * tests/unit/leagueMessageFacts.test.ts. A made-up stat in a note addressed to
 * the whole league would be found out by Sunday lunchtime.
 */

/**
 * Mapped to weeks 1 through 3 on purpose. The seed carries no results, so the
 * engine still calls week 1 current until the live sync lands them, at which
 * point week 3 is — and the league needs the review under whichever key it is
 * shown.
 */
const WEEK_2_REVIEW = {
  heading: 'Word from the commissioner',
  lines: [
    'Week 2 is in the books. Fourteen of you are a life lighter, nobody is out, and three of you are down to your last life in September, which is the kind of pace that gets you cut from a nature documentary. Ten of you are still holding all three. Enjoy it. It will not last, and I say that with the warmth of a man who is on two.',
    'Eleven of you looked at thirty-two teams and ordered San Francisco, and San Francisco did what the special does at a good restaurant: touchdowns on its first five drives, 35–13, no notes. Brock Purdy threw twenty-two passes and missed two of them, which — I checked — is a better completion rate than this league managed on sending its picks in. Christian McCaffrey scored the hundredth touchdown of his career, and eleven of you nodded as if you had planned it. You did not plan it. You saw a menu and pointed at the thing the table next to you was having.',
    'Then there is Tampa Bay. Seven of you were on the Buccaneers at home to Cleveland, and I wrote that by about three o’clock one side of that game would be explaining itself. I apologise for the timing. Lightning stopped play for two hours and twelve minutes, so the explaining did not begin until after five, when Deshaun Watson found Blake Whiteheart for the go-ahead score and Baker Mayfield’s fourth-down pass from the twenty fell to earth like the rest of the afternoon. Cleveland 23, Tampa Bay 19. Chloe, Corey, Joseph, KC, Nate, Paul and Sheila: you gave a life and five hours of a Sunday to a team that produced nine first-half points, all of them field goals, at home, against Cleveland. Tony, alone on the Browns, has now beaten seven of you single-handedly, and there is nothing in the rules that stops him bringing it up for the rest of the season. I checked that too.',
    'Dave, Don and Maya took Baltimore at home, watched them lead 14–3 at the half, and then watched a quarterback named Tyler Shough sneak in on fourth down with 1:28 left. 24–17. The NFL’s replay office reviewed it and announced that it could not prove he did not break the plane, which is the officiating equivalent of a shrug. Three of you lost a life on a play the league itself could not see. I would call that unlucky, except Baltimore then threw an interception with thirteen seconds left, so let us call it what it was.',
    'Bradley took Chicago and received, in return, three points, a fumble on the one-yard line, a blocked twenty-three-yard field goal and rain. Minnesota 9, Chicago 3, in a game with no touchdowns in it. Bradley paid a life for that. Some people pay for a ticket. He has now burned Detroit and Chicago in consecutive weeks, working through the NFC North like a man reading the menu top to bottom, and the two he has left, Minnesota and Green Bay, are the two that actually won this week. The system works. It is simply working for other people.',
    'Only two of you left the house. Melanie took Philadelphia at Tennessee and was repaid with a game-winning touchdown with nine seconds left, to a receiver catching the first touchdown of his career, on a turf surface measured at 157 degrees — hot enough that the safest place on the field was the end zone, which is eventually where the Eagles went. Tony, we have covered. Both road picks won. Eleven of the twenty-five home picks did not. The lesson, as ever in this league, is that comfort is expensive.',
    'Joanna, Allison and Phyllis were on Buffalo, where Josh Allen scored five touchdowns in the first game at the new stadium and the Bills led 21–0 before the second quarter was four minutes old. Their week was decided before some of you had found the remote. Allison’s week 1 team, Detroit, gave up forty-one points to Allison’s week 2 team, Buffalo. Allison is two for two, and the teams she has moved on from are 0–1 since she left them. I am not saying she is the problem. I am saying I would not pick against her.',
    'Three picks did not arrive by Thursday’s lock: Jared, Tina and Craig. A missing pick costs exactly what a losing one does, and the rulebook does not have a box marked “meant to”. I looked twice, because all three are people I like. Jared and Craig were also among the seven of us buried by the Chargers in week 1, so with Nate — the Chargers, then Tampa Bay, a double bill of grief — they are the three down to a single life. Speaking of the Chargers: 26–14 to Arizona in week 1, 26–14 to the Raiders in week 2. The same score twice. That is not a slump, that is a subscription. Jim Harbaugh is 0–2 for the first time in his coaching career, college or pro, and seven of you hold a share in the milestone.',
    'Week 3 has no byes either, so all thirty-two teams are back on the menu, including the ones that hurt you. The Chargers visit Buffalo, for anyone who enjoys watching things they have already paid for. Arizona, the team that started the Chargers’ 26–14 habit, visits San Francisco, which eleven of you can no longer use and will now have to watch like everybody else. Thursday night is Atlanta at Green Bay. Atlanta lost 34–3 to Carolina on Sunday, at home, starting their backup quarterback. I am not allowed to make your picks for you. I am allowed to raise an eyebrow, and it is raised.',
  ],
  // Set apart from the banter, because an instruction buried in jokes is an
  // instruction somebody misses — and this week three people did.
  callout:
    'DM me your week 3 pick on Teams before Thursday’s kickoff. Picks lock at 7:10 PM Thursday, five minutes before Atlanta at Green Bay. A missing pick costs a life — three of you can now confirm this, and I would rather it stayed three.',
}

const NOTES: Record<number, { heading: string; lines: string[]; callout?: string }> = {
  1: WEEK_2_REVIEW,
  2: WEEK_2_REVIEW,
  3: WEEK_2_REVIEW,
}

export function LeagueMessage({ week }: { week: number }) {
  const note = NOTES[week]
  if (!note) return null

  return (
    <section
      className="card border-sky-400/25 p-5 md:p-6"
      aria-labelledby="league-message-title"
    >
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
      {note.callout && (
        // Set apart from the banter on purpose: an instruction buried in a
        // joke is an instruction somebody misses, and missing costs a life.
        <p className="mt-4 flex max-w-3xl items-start gap-3 rounded-xl border border-gold-400/40 bg-gold-400/10 p-4 font-medium text-ink-100">
          <Send className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" aria-hidden="true" />
          <span>{note.callout}</span>
        </p>
      )}
    </section>
  )
}
