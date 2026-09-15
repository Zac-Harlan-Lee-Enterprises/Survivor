import { Megaphone } from 'lucide-react'

/**
 * The commissioner's note to the league, between the scoreboard and the
 * standings.
 *
 * The copy is editorial and lives here on purpose: it is written for one moment
 * in the season, not derived from the data. `week` gates it, so when the league
 * moves on and nobody has written the next one, the section simply is not
 * there rather than shouting about a week gone by.
 *
 * Every number below is from the real week 1 result, checked against the ESPN
 * scoreboard and contemporary reports — a made-up stat in a note addressed to
 * the whole league would be found out by Sunday lunchtime.
 */

/**
 * Mapped to both weeks on purpose: week 1 is not final until Monday night's
 * game is synced, so keying this to week 2 alone would leave the league reading
 * a preview of games that had already been played.
 */
const WEEK_1_REVIEW = {
  heading: 'Word from the commissioner',
  lines: [
    'Last week this column observed that calling the Jaguars a sure thing has never once ended well — Trevor Lawrence then went 18 of 23 for four touchdowns, Jacksonville led 24–0 at the half, and all seven of you may consider the record corrected.',
    'The six who took the Chargers instead watched Jacoby Brissett outplay Justin Herbert in Herbert’s own stadium, while Arizona held the ball for thirty-seven minutes and won 26–14; your commissioner was one of the six, so there will be no further commentary on that game.',
    'Detroit’s six led 21–0, then surrendered scores on five of the Saints’ last six drives and survived 31–30 only because a two-point conversion in overtime fell incomplete.',
    'We did ask whether Joanna on the Cowboys and Matt on the Packers were the two sharpest minds here or the only two who had not read the group chat — the Giants and the Vikings have filed their answer.',
    'Twenty-one of you come through unmarked, eight are down to two lives, and the Seahawks four have the quietest 13–10 in football to thank for it.',
  ],
}

const NOTES: Record<number, { heading: string; lines: string[] }> = {
  1: WEEK_1_REVIEW,
  2: WEEK_1_REVIEW,
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
    </section>
  )
}
