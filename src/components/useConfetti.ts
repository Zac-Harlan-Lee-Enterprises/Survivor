import { useEffect, useRef } from 'react'

/** Fires a confetti burst once per mount when `active` is true (respects reduced motion). */
export function useConfetti(active: boolean) {
  const fired = useRef(false)
  useEffect(() => {
    if (!active || fired.current) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    fired.current = true
    let cancelled = false
    import('canvas-confetti').then(({ default: confetti }) => {
      if (cancelled) return
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
    return () => {
      cancelled = true
    }
  }, [active])
}
