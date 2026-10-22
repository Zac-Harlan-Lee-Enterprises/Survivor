import { Megaphone } from 'lucide-react'

/**
 * The commissioner's approved paragraph. Keep the existing week 1–7 display
 * scope; the commissioner decides when to replace the message.
 */
const WEEK_7_NOTE = {
  heading: 'Word from the late commissioner',
  body: 'Being commissioner was easier when I was alive. Now I spend my weekends answering messages from the living while Death leans over my shoulder asking, “Anything yet?” The man has absolutely no patience for a pending result. He’s already sharpened his pencil, cleared space in the cemetery, and asked whether we offer a group rate. I told him these are my friends and he should show some respect, so he took his feet off my desk. That’s apparently the extent of the accommodation. Good luck this week, everyone. I’m rooting for you. The tall gentleman behind me has declined to comment.',
}

export function LeagueMessage({ week }: { week: number }) {
  if (week < 1 || week > 7) return null

  return (
    <section className="card border-sky-400/25 p-5 md:p-6" aria-labelledby="league-message-title">
      <h2 id="league-message-title" className="eyebrow flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-sky-400" aria-hidden="true" />
        {WEEK_7_NOTE.heading}
      </h2>
      <div className="mt-3 space-y-2 text-ink-200">
        <p className="max-w-3xl leading-relaxed">{WEEK_7_NOTE.body}</p>
      </div>
    </section>
  )
}
