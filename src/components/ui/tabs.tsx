import * as TabsPrimitive from '@radix-ui/react-tabs'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

export const Tabs = TabsPrimitive.Root
export const TabsContent = TabsPrimitive.Content

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex flex-wrap gap-1 rounded-xl border border-white/10 bg-pitch-800 p-1',
        className,
      )}
      {...props}
    />
  )
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'rounded-lg px-3 py-1.5 font-display text-sm font-bold uppercase tracking-wide text-ink-300 transition-colors hover:text-ink-50 focus-visible:ring-2 focus-visible:ring-sky-400 data-[state=active]:bg-pitch-600 data-[state=active]:text-ink-50',
        className,
      )}
      {...props}
    />
  )
}
