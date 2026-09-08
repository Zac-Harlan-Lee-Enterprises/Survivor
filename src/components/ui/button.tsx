import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-display text-base font-bold uppercase tracking-wide transition-[transform,background-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-pitch-900 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 select-none',
  {
    variants: {
      variant: {
        primary:
          'bg-gold-400 text-pitch-950 hover:bg-gold-300 shadow-[0_6px_20px_-8px_rgba(251,191,36,0.8)]',
        secondary: 'bg-pitch-700 text-ink-50 hover:bg-pitch-600 border border-white/10',
        ghost: 'bg-transparent text-ink-100 hover:bg-white/5',
        danger: 'bg-flag-600 text-white hover:bg-flag-500',
        outline: 'border border-white/20 bg-transparent text-ink-50 hover:bg-white/5',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-5',
        lg: 'h-14 px-7 text-lg',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? 'button')}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'
