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
 * Mapped to weeks 1 through 7 on purpose. The seed carries no results, so the
 * engine calls week 1 current until the live sync lands them, at which point
 * week 7 is — and the league needs the review under whichever key it is shown.
 *
 * Week 6 is public, so the review names picks. It says nothing about week 7
 * picks, which are hidden until Thursday.
 */
const WEEK_6_REVIEW = {
  heading: 'Word from the late commissioner',
  lines: [
    'Thirteen of you took the Rams at home to Arizona: a 2–3 team against a 1–4 team that had lost four straight. Arizona won 18–16 without scoring a touchdown. Chad Ryland kicked six field goals, and when the Rams went ahead 16–15 with forty-seven seconds left, that turned out to be exactly enough time for him to kick the sixth as the clock hit zero. All thirteen of you lost a life, and nine of you lost your last one. One of the nine is writing this.',
    'Five of you took Indianapolis at home to Tennessee — 0–5, the Tennessee whose offense, I wrote last week, had less going on than our graveyard. The Colts led 13–0 at halftime. Then Tennessee blocked a punt and ran it back for a touchdown, and their kicker, a man named Joey, kicked four field goals, the last two in the final 2:03, to win 26–20: Tennessee’s first win of the season. Our Joey has been in the ground a week, and a Joey is still burying people.',
    'The count: twelve of you were knocked out this week. James, Stacey, Sheila, Matt, KC, Paul, Tony, Tina and I went down with the Rams; Chloe, Corey and Joanna with the Colts. Last week’s five was a league record; this week’s twelve is more than double it. The graveyard went from six to eighteen, and there are now more of us in the ground than above it: eighteen headstones, twelve survivors. Every one of the twelve has an epitaph on their profile, including me, which means I wrote my own.',
    'The five who lost nothing: Bradley went alone with San Francisco, 23–17 over Washington, and the 49ers are 6–0, the only team in the league with six wins. Cindy, Dominic, Maya and Melanie took New England over the Jets, 26–19, on three Drake Maye touchdown passes. Allison lost her first life of the season with the Colts, which leaves Cindy as the only one of us still holding all three: six picks, six wins. She and I picked the same team in weeks 2 and 3; after that I went my own way, and you can see where it got me.',
    'Some housekeeping from the season so far. Arizona have won two games all year — the Chargers in week 1 and the Rams this week — and Stacey, Tony and I picked Los Angeles both times. The Chargers are now 0–6, so the seven of you who took them in week 1 weren’t unlucky, just early. Everyone who picked Seattle in week 3 — Don, James, Corey and Joanna — is now dead. Paul is still the only one of us ever to lose a life to a tie. Dallas lost 23–13 in Green Bay on Sunday night, so the twenty-one of you who rode them in week 5 got the full Cowboys experience at no extra charge. And Joey: the Bears won 31–23 in Atlanta, their first game since you died. They waited.',
    'Where we stand: twelve alive. Cindy is on three lives, Allison and Melanie on two, and nine of you — Bradley, Dave, Dominic, Jason, Maya, Mike, Shahid, Tracy and Wesley — are on your last. Wesley sent no pick at all this week, lost a life for it, and is still standing because his first four picks all won. Let that be a lesson to nobody.',
    'Week 7 has four teams on bye: Buffalo, Jacksonville, Washington and the Chargers, for whom it is the first week all season they cannot lose. Thursday night is New England at Chicago, two 4–2 teams, which locks the week. The three unbeaten teams all play: San Francisco (6–0) at Atlanta, Minnesota (5–0) at home to the Colts, and Kansas City (5–0) at Seattle on Sunday night. Miami, 0–5, visit the Jets. There are only twelve of you left to bury, so take your time.',
  ],
  // Set apart from the banter, because an instruction buried in jokes is an
  // instruction somebody misses — and nine people are on their last life.
  callout:
    'DM me your week 7 pick on Teams before 7:10 PM Thursday — five minutes before New England at Chicago kicks off. Nine of you are on your last life, and a missing pick costs a life.',
}

const NOTES: Record<number, { heading: string; lines: string[]; callout?: string }> = {
  1: WEEK_6_REVIEW,
  2: WEEK_6_REVIEW,
  3: WEEK_6_REVIEW,
  4: WEEK_6_REVIEW,
  5: WEEK_6_REVIEW,
  6: WEEK_6_REVIEW,
  7: WEEK_6_REVIEW,
}

export function LeagueMessage({ week }: { week: number }) {
  const note = NOTES[week]
  if (!note) return null

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
