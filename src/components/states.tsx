import { AlertTriangle, Loader2 } from 'lucide-react'
import { DataError } from '@/data'
import { Button } from './ui/button'

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-ink-300"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-8 w-8 animate-spin text-sky-400" aria-hidden="true" />
      <p className="font-display text-lg uppercase tracking-widest">{label}…</p>
    </div>
  )
}

export function ErrorState({
  error,
  retry,
  title = 'Something went sideways',
}: {
  error: unknown
  retry?: () => void
  title?: string
}) {
  const message =
    error instanceof DataError
      ? error.message
      : error instanceof Error
        ? error.message
        : 'Unknown error'
  const offline = error instanceof DataError && error.status === 0
  return (
    <div className="card mx-auto my-10 max-w-lg p-6 text-center" role="alert">
      <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-gold-400" aria-hidden="true" />
      <h2 className="font-display text-2xl font-bold uppercase text-ink-50">
        {offline ? 'League server unreachable' : title}
      </h2>
      <p className="mt-2 text-ink-200">{message}</p>
      {offline && (
        <p className="mt-2 text-sm text-ink-300">
          Standings shown elsewhere may be stale. Picks are saved only once the server confirms
          them.
        </p>
      )}
      {retry && (
        <Button className="mt-5" variant="secondary" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  )
}
