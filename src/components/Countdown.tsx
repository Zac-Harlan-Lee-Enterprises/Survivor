import { useNow } from '@/app/hooks'
import { countdownTo, formatCountdown } from '@/lib/time'
import { cn } from '@/lib/cn'

export function Countdown({
  to,
  className,
  prefix = 'Kickoff in',
}: {
  to: string
  className?: string
  prefix?: string
}) {
  const now = useNow(1000)
  const c = countdownTo(to, now)
  const urgent = !c.past && c.totalMs < 3_600_000
  return (
    <span
      className={cn(
        'font-display tabular-nums',
        urgent && 'text-gold-300 animate-pulse-soft',
        className,
      )}
      aria-live="off"
    >
      {c.past ? 'Kicked off' : `${prefix} ${formatCountdown(c)}`}
    </span>
  )
}
