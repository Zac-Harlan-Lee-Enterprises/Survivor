import { Megaphone } from 'lucide-react'

/**
 * The commissioner's note to the league, between the scoreboard and the
 * standings.
 *
 * The copy is editorial and lives here on purpose: it is written for one moment
 * in the season, not derived from the data. `week` gates it so a note about
 * week 1 does not still be shouting in November — when the league moves on and
 * nobody has written the next one, the section simply is not there.
 */
const NOTES: Record<number, { heading: string; lines: string[] }> = {
  1: {
    heading: 'Word from the commissioner',
    lines: [
      'Twenty-eight of you had thirty-two teams to choose from, and twenty-two still managed to pile onto four of them.',
      'Seven have decided the Jaguars are a sure thing, which is a sentence that has never once ended well.',
      'Joanna stands alone on the Cowboys and Matt alone on the Packers — either the two sharpest minds in the league, or the only two who did not read the group chat.',
      'The Seahawks four find out tonight; the rest of you get another seventy-two hours of completely unearned confidence.',
    ],
  },
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
