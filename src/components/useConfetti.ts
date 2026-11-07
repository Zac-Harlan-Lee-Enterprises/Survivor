import { useEffect, useRef, useState } from 'react'
import type confettiLib from 'canvas-confetti'

// Loaded on first use and shared, so every page reuses one copy of the library.
let library: Promise<{ default: typeof confettiLib }> | undefined
const loadConfetti = () => (library ??= import('canvas-confetti'))

/**
 * Celebrates the winner: returns a ref for the element that shows them, and
 * fires one confetti burst per page load the first time that element is on
 * screen. Respects reduced motion.
 */
export function useConfetti(active: boolean) {
  const [target, setTarget] = useState<Element | null>(null)
  const fired = useRef(false)

  useEffect(() => {
    if (!active || !target || fired.current) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let cancelled = false

    const burst = () => {
      void loadConfetti().then(({ default: confetti }) => {
        // Marked only once the burst starts: StrictMode cancels the first run,
        // and the re-run must still be allowed to fire.
        if (cancelled || fired.current) return
        fired.current = true
        const end = Date.now() + 1200
        const frame = () => {
          confetti({
            particleCount: 40,
            spread: 70,
            startVelocity: 45,
            origin: { x: 0.1, y: 0.7 },
            colors: ['#fbbf24', '#f7f8fc', '#22c55e'],
          })
          confetti({
            particleCount: 40,
            spread: 70,
            startVelocity: 45,
            origin: { x: 0.9, y: 0.7 },
            colors: ['#fbbf24', '#f7f8fc', '#38bdf8'],
          })
          if (Date.now() < end) requestAnimationFrame(frame)
        }
        frame()
      })
    }

    if (typeof IntersectionObserver === 'undefined') {
      burst()
      return () => {
        cancelled = true
      }
    }
    const watch = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          watch.disconnect()
          burst()
        }
      },
      { threshold: 0.5 },
    )
    watch.observe(target)
    return () => {
      cancelled = true
      watch.disconnect()
    }
  }, [active, target])

  return setTarget
}
