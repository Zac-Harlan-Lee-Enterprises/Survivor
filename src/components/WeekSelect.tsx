import { ChevronDown } from 'lucide-react'
import { useSelectedWeek } from '@/app/useSelectedWeek'
import { cn } from '@/lib/cn'

/**
 * Week navigator. A native <select> on purpose: it is keyboard accessible for
 * free and opens as the platform picker on a phone, which beats any custom
 * menu for eighteen options on a small screen.
 */
export function WeekSelect({ className }: { className?: string }) {
  const { week, weeks, currentWeek, setWeek } = useSelectedWeek()

  return (
    <label
      className={cn(
        'relative items-center rounded-full border border-white/10 bg-white/5',
        'focus-within:ring-2 focus-within:ring-sky-400',
        className,
      )}
    >
      <span className="sr-only">Show a week</span>
      <select
        value={week}
        onChange={(e) => setWeek(Number(e.target.value))}
        className="cursor-pointer appearance-none rounded-full bg-transparent py-1 pr-8 pl-3 font-display text-sm font-bold uppercase tracking-widest text-ink-200 focus:outline-none"
      >
        {weeks.map((w) => (
          <option key={w.week} value={w.week} className="bg-pitch-800 text-ink-100">
            Week {w.week}
            {w.week === currentWeek ? ' • now' : ''}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-ink-400"
        aria-hidden="true"
      />
    </label>
  )
}
