import { cn } from '@/lib/cn'

/** Lives shown as footballs — filled while alive, hollow once lost. */
export function LivesMeter({
  total,
  remaining,
  size = 'md',
  className,
}: {
  total: number
  remaining: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const px = size === 'sm' ? 16 : size === 'lg' ? 32 : 22
  return (
    <div
      className={cn('inline-flex items-center gap-1', className)}
      role="img"
      aria-label={`${remaining} of ${total} lives remaining`}
    >
      {Array.from({ length: total }, (_, i) => {
        const alive = i < remaining
        return (
          <svg
            key={i}
            width={px}
            height={px}
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={cn(
              'transition-transform',
              alive ? 'drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]' : 'opacity-40',
            )}
          >
            <ellipse
              cx="12"
              cy="12"
              rx="10"
              ry="6.5"
              transform="rotate(-35 12 12)"
              fill={alive ? '#c2410c' : 'none'}
              stroke={alive ? '#fde68a' : '#7d86a6'}
              strokeWidth="1.6"
            />
            {alive && (
              <path
                d="M8.5 15.5 L15.5 8.5 M10.3 12.3l1.4 1.4M12.2 10.4l1.4 1.4"
                stroke="#fde68a"
                strokeWidth="1.4"
                strokeLinecap="round"
                fill="none"
              />
            )}
            {!alive && (
              <path
                d="M7 7l10 10M17 7L7 17"
                stroke="#7d86a6"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            )}
          </svg>
        )
      })}
    </div>
  )
}
