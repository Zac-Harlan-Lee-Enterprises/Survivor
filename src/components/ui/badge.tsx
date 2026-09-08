import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-display text-xs font-bold uppercase tracking-wider',
  {
    variants: {
      tone: {
        neutral: 'border-white/10 bg-white/5 text-ink-200',
        alive: 'border-turf-500/40 bg-turf-500/15 text-turf-400',
        bubble: 'border-gold-400/50 bg-gold-400/15 text-gold-300',
        out: 'border-flag-500/40 bg-flag-500/15 text-flag-400',
        champion: 'border-gold-400 bg-gold-400 text-pitch-950',
        info: 'border-sky-400/40 bg-sky-400/15 text-sky-400',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}
