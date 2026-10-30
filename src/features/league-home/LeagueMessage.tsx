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
 *
 * Week 8, after the lock: the commissioner's call — just good luck.
 */
const WEEK_8_PREVIEW: { heading: string; lines: string[]; callout?: string } = {
  heading: 'Word from the late commissioner',
  lines: ['Good luck.'],
}

export function LeagueMessage({ week }: { week: number }) {
  if (week < 1 || week > 8) return null
  const note = WEEK_8_PREVIEW

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
