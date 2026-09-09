import { useLeagueContext, useLeagueTimeZone } from '@/app/hooks'
import { useAudit, useOverrides } from '@/app/queries'
import { LoadingState } from '@/components/states'
import { formatDateTime } from '@/lib/time'

export function AuditPanel() {
  const tz = useLeagueTimeZone()
  const { league, snapshot, profileOf } = useLeagueContext()
  const audit = useAudit(league.id)
  const overrides = useOverrides(snapshot.season.id)
  if (audit.isLoading || overrides.isLoading) return <LoadingState label="Loading audit" />
  const name = (id: string | null) => (id ? profileOf(id).displayName : 'system')

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section aria-labelledby="au-title">
        <h2 id="au-title" className="mb-3 text-2xl text-ink-50">
          Audit log
        </h2>
        {(audit.data ?? []).length === 0 ? (
          <p className="text-sm text-ink-400">
            Nothing yet. Every pick, correction and setting change lands here.
          </p>
        ) : (
          <ol className="card divide-y divide-white/5 p-0 text-sm">
            {(audit.data ?? []).map((e) => (
              <li key={e.id} className="p-3">
                <p className="text-ink-100">{e.summary}</p>
                <p className="text-xs text-ink-400">
                  {formatDateTime(e.at, tz)} · {name(e.actorPlayerId)} ·{' '}
                  <span className="font-mono">{e.type}</span>
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section aria-labelledby="ov-title">
        <h2 id="ov-title" className="mb-3 text-2xl text-ink-50">
          Commissioner overrides
        </h2>
        {(overrides.data ?? []).length === 0 ? (
          <p className="text-sm text-ink-400">No overrides recorded.</p>
        ) : (
          <ol className="card divide-y divide-white/5 p-0 text-sm">
            {(overrides.data ?? []).map((o) => (
              <li key={o.id} className="p-3">
                <p className="text-ink-100">
                  <span className="font-display uppercase text-gold-300">{o.type}</span> ·{' '}
                  {o.targetId} — {o.reason}
                </p>
                <p className="text-xs text-ink-400">
                  {formatDateTime(o.createdAt, tz)} · {name(o.actorPlayerId)}
                </p>
                <details className="mt-1 text-xs text-ink-300">
                  <summary className="cursor-pointer">Before / after</summary>
                  <pre className="mt-1 overflow-x-auto rounded bg-pitch-950 p-2">
                    {JSON.stringify({ before: o.before ?? null, after: o.after ?? null }, null, 2)}
                  </pre>
                </details>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
