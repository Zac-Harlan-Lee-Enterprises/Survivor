import { ExternalLink, ScrollText } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import rulesDoc from '../../../docs/survivor-rules.md?raw'
import { useLeagueContext, useServices } from '@/app/hooks'
import { getConfig } from '@/config/env'
import { extractMarkedRegion, parseMarkdown, type Block, type Span } from '@/lib/markdown'
import { zoneAbbreviation } from '@/lib/time'

/**
 * The league's official rulebook, rendered from `docs/survivor-rules.md` —
 * the same document the rules engine is tested against. There is no second
 * copy of the rules to fall out of date.
 *
 * The strip at the top reads this league's live settings, so if a setting ever
 * disagreed with the prose, the number a player actually plays under is the
 * one on screen.
 *
 * Only the region the document marks for players is rendered — the notes about
 * how the engine is built are for the repo, not for league members.
 */
export function RulesPage() {
  const { league } = useLeagueContext()
  const { clock } = useServices()
  const { repoUrl } = getConfig()
  const s = league.settings
  // The document titles itself; the page supplies its own heading instead.
  const blocks = useMemo(
    () =>
      parseMarkdown(
        extractMarkedRegion(rulesDoc, '<!-- begin-player-rules -->', '<!-- end-player-rules -->'),
      ).filter((b) => !(b.kind === 'heading' && b.level === 1)),
    [],
  )

  const lock =
    s.pickLockMinutesBeforeFirstKickoff === 0
      ? 'at the first kickoff'
      : `${s.pickLockMinutesBeforeFirstKickoff} min before the first kickoff`

  return (
    <div className="space-y-8">
      <header className="card p-6">
        <p className="eyebrow flex items-center gap-2">
          <ScrollText className="h-4 w-4" aria-hidden="true" /> {league.name}
        </p>
        <h1 className="mt-2 font-display text-4xl font-extrabold uppercase tracking-wide text-ink-50">
          Official rules
        </h1>
        <p className="mt-2 max-w-2xl text-ink-300">
          Pick one team to win each week. Lose or tie and you burn a life. Last one standing wins.
          Everything below is what the scoreboard actually enforces.
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact label="Lives" value={String(s.defaultLives)} />
          <Fact label="Picks lock" value={lock} />
          <Fact label="A tie" value={s.tieCountsAsMiss ? 'Costs a life' : 'Is safe'} />
          <Fact label="Times shown in" value={zoneAbbreviation(s.displayTimeZone, clock.now())} />
        </dl>
      </header>

      <article className="card space-y-4 p-6 leading-relaxed text-ink-200">
        {blocks.map((block, i) => (
          <BlockView key={i} block={block} repoUrl={repoUrl} />
        ))}
      </article>

      <footer className="text-sm text-ink-400">
        The commissioner has the final word on anything these rules do not cover.
        {repoUrl !== null && (
          <>
            {' '}
            <a
              className="inline-flex items-center gap-1 text-sky-400 underline underline-offset-2 hover:text-ink-50"
              href={`${repoUrl}/blob/main/docs/survivor-rules.md`}
              target="_blank"
              rel="noreferrer"
            >
              View the source rulebook
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </>
        )}
      </footer>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-3 py-2">
      <dt className="font-display text-[11px] font-bold uppercase tracking-widest text-ink-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-semibold text-ink-50">{value}</dd>
    </div>
  )
}

function BlockView({ block, repoUrl }: { block: Block; repoUrl: string | null }): ReactNode {
  const spans = (list: Span[]) => <Spans spans={list} repoUrl={repoUrl} />

  switch (block.kind) {
    case 'heading':
      return block.level === 2 ? (
        <h2 className="pt-4 font-display text-2xl font-extrabold uppercase tracking-wide text-gold-300 first:pt-0">
          {spans(block.spans)}
        </h2>
      ) : (
        <h3 className="pt-2 font-display text-lg font-bold text-ink-50">{spans(block.spans)}</h3>
      )
    case 'paragraph':
      return <p>{spans(block.spans)}</p>
    case 'list':
      return (
        <ul className="ml-5 list-disc space-y-2 marker:text-gold-400">
          {block.items.map((item, i) => (
            <li key={i}>{spans(item)}</li>
          ))}
        </ul>
      )
    case 'table':
      return (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
            <thead>
              <tr>
                {block.header.map((cell, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="border-b border-white/15 py-2 pr-4 font-display text-xs font-bold uppercase tracking-widest text-ink-300"
                  >
                    {spans(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className="border-b border-white/8 py-2 pr-4 align-top">
                      {spans(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
  }
}

function Spans({ spans, repoUrl }: { spans: Span[]; repoUrl: string | null }) {
  return (
    <>
      {spans.map((span, i) => {
        switch (span.kind) {
          case 'strong':
            return (
              <strong key={i} className="font-semibold text-ink-50">
                {span.text}
              </strong>
            )
          case 'em':
            return (
              <em key={i} className="text-ink-100 italic">
                {span.text}
              </em>
            )
          case 'code':
            return (
              <code key={i} className="rounded bg-white/8 px-1 py-0.5 text-[0.85em] text-sky-400">
                {span.text}
              </code>
            )
          case 'link': {
            // Relative links point at other files in the repo, which mean
            // nothing to the browser here — resolve them against the repo.
            const external = /^https?:\/\//.test(span.href)
            const href = external
              ? span.href
              : repoUrl === null
                ? null
                : `${repoUrl}/blob/main/docs/${span.href.replace(/^\.?\//, '')}`
            if (href === null) return <span key={i}>{span.text}</span>
            return (
              <a
                key={i}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 underline underline-offset-2 hover:text-ink-50"
              >
                {span.text}
              </a>
            )
          }
          default:
            return <span key={i}>{span.text}</span>
        }
      })}
    </>
  )
}
