import { CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Notice({
  tone,
  children,
  className,
}: {
  tone: 'success' | 'error'
  children: React.ReactNode
  className?: string
}) {
  const Icon = tone === 'success' ? CheckCircle2 : XCircle
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2 rounded-xl border px-3 py-2 text-sm',
        tone === 'success'
          ? 'border-turf-500/40 bg-turf-500/10 text-turf-400'
          : 'border-flag-500/40 bg-flag-500/10 text-flag-400',
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="text-ink-100">{children}</div>
    </div>
  )
}
