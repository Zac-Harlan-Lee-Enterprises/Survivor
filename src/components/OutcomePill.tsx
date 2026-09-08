import type { PickOutcome } from '@/domain'
import { outcomeLabel } from '@/lib/copy'
import { cn } from '@/lib/cn'

const TONES: Record<PickOutcome, string> = {
  win: 'bg-turf-500/20 text-turf-400 border-turf-500/40',
  loss: 'bg-flag-500/20 text-flag-400 border-flag-500/40',
  tie: 'bg-gold-400/20 text-gold-300 border-gold-400/40',
  missing: 'bg-flag-500/20 text-flag-400 border-flag-500/40 border-dashed',
  pending: 'bg-white/5 text-ink-200 border-white/10',
  void: 'bg-white/5 text-ink-300 border-white/10 line-through',
  not_required: 'bg-transparent text-ink-400 border-transparent',
}

export function OutcomePill({ outcome, className }: { outcome: PickOutcome; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 font-display text-[11px] font-bold uppercase tracking-wider',
        TONES[outcome],
        className,
      )}
    >
      {outcomeLabel(outcome)}
    </span>
  )
}
