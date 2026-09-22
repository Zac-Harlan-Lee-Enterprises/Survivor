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
    'Week 2 is in the books and fourteen of you are a life lighter. Nobody is out. Ten of you are still holding all three, seventeen are on two, and three of you are down to your last one in September, which is a pace. We will get to who.',
    'Eleven of you ordered San Francisco, and San Francisco delivered: touchdowns on its first five drives, 35–13, and Brock Purdy threw twenty-two passes and missed two of them. Christian McCaffrey scored the hundredth touchdown of his career and eleven of you nodded along as if you had planned it. You did not plan it. You saw a menu with thirty-two options and ordered the special.',
    'Then there is Tampa Bay. Seven of you were on the Buccaneers at home to Cleveland, and I said one side of that game would be explaining itself by about three o’clock. I was wrong about the time. Lightning stopped play for two hours and twelve minutes, so it was after five when Deshaun Watson found Blake Whiteheart for the go-ahead score and Baker Mayfield’s fourth-down pass from the twenty fell incomplete. Cleveland 23, Tampa Bay 19. Chloe, Corey, Joseph, KC, Nate, Paul and Sheila: you spent a life and an entire afternoon on a team that scored nine points in the first half, all of them field goals. Tony, alone on the Browns, has now beaten seven of you single-handedly and would like that noted.',
    'Dave, Don and Maya took Baltimore at home, watched them lead 14–3 at the half, and lost 24–17 to a fourth-down quarterback sneak by Tyler Shough with 1:28 left. The league’s replay office reviewed it and announced that it could not prove he did not break the plane. Three of you lost a life on a play the NFL could not see clearly either.',
    'Bradley took Chicago and received three points, a fumble on the one-yard line and a blocked twenty-three-yard field goal, in the rain, in a game with no touchdowns in it. Minnesota 9, Chicago 3. He has now burned Detroit and Chicago in consecutive weeks, working through the NFC North like a man reading a menu top to bottom, and the two he has left, Minnesota and Green Bay, are the two that actually won this week.',
    'Only two of you left the house. Melanie took Philadelphia at Tennessee and was repaid with a game-winning touchdown pass with nine seconds left, to a receiver catching the first touchdown of his career, on a turf surface measured at 157 degrees. Tony, we have covered. Both road picks won. Eleven of the twenty-five home picks did not. Draw your own conclusions about the comforts of home.',
    'Joanna, Allison and Phyllis were on Buffalo, where Josh Allen scored five touchdowns in the first game at the new stadium and the Bills led 21–0 before the second quarter was four minutes old. Allison’s week 1 team gave up forty-one points to Allison’s week 2 team. She has picked two winners and I remain slightly afraid of her.',
    'Three picks did not arrive by Thursday’s lock: Jared, Tina and Craig. A missing pick costs exactly what a losing one does, and the rules do not have a box marked “meant to”. Jared and Craig were also among the seven of us buried by the Chargers in week 1, so along with Nate — the Chargers, then Tampa Bay — they are the three down to a single life. As for the Chargers: 26–14 to Arizona in week 1, 26–14 to the Raiders in week 2, which is not a slump so much as a policy. Jim Harbaugh is 0–2 for the first time in his coaching career, college or pro. Seven of you own a piece of that.',
    'Week 3 has no byes either, so all thirty-two are back on the menu. The Chargers visit Buffalo, for those of you who enjoy watching things you have already paid for. Arizona, the team that started the Chargers’ 26–14 habit, visits San Francisco, which eleven of you can no longer use. Thursday night is Atlanta at Green Bay. Atlanta lost 34–3 to Carolina on Sunday. You may draw your own conclusions; I am not allowed to draw them for you.',
  ],
  // Set apart from the banter, because an instruction buried in jokes is an
  // instruction somebody misses — and this week three people did.
  callout:
    'DM me your week 3 pick on Teams before Thursday’s kickoff. Picks lock at 7:10 PM Thursday, five minutes before Atlanta at Green Bay — and a missing pick costs a life, as three of you can now confirm.',
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
