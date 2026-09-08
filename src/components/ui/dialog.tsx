import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export const Dialog = DialogPrimitive.Root

export function DialogContent({
  className,
  children,
  title,
  description,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { title: ReactNode; description?: ReactNode }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-pitch-950/80 backdrop-blur-sm data-[state=open]:animate-rise" />
      <DialogPrimitive.Content
        className={cn(
          'card fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 p-6 data-[state=open]:animate-rise',
          className,
        )}
        {...props}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <DialogPrimitive.Title className="font-display text-2xl font-bold uppercase text-ink-50">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-sm text-ink-300">
                {description}
              </DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">Dialog</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close
            className="rounded-lg p-1 text-ink-300 hover:bg-white/10 hover:text-ink-50 focus-visible:ring-2 focus-visible:ring-sky-400"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
