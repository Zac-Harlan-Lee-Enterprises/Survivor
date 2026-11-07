import { useEffect, useRef, useState } from 'react'
import type confettiLib from 'canvas-confetti'
import { crown } from './crowning'
import { cue } from './music'
import { getConfig } from '@/config/env'

// Loaded on first use and shared, so every page reuses one copy of the library.
let library: Promise<{ default: typeof confettiLib }> | undefined
const loadConfetti = () => (library ??= import('canvas-confetti'))

const GOLD_AND_IVORY = ['#fbbf24', '#fde68a', '#fff7e0', '#d97706']

/**
 * The finale: three measured volleys of gold and ivory, one from each lower
 * corner and one up from the winner, a beat apart.
 */
function burst(target: Element, cancelled: () => boolean) {
  void loadConfetti().then(({ default: confetti }) => {
    if (cancelled()) return
    const box = target.getBoundingClientRect()
    const vw = window.innerWidth || 1
    const vh = window.innerHeight || 1
    const winner = {
      x: Math.min(Math.max((box.left + box.width / 2) / vw, 0.05), 0.95),
      y: Math.min(Math.max((box.top + box.height / 2) / vh, 0.1), 0.9),
    }
    const volley = {
      particleCount: 70,
      spread: 62,
      startVelocity: 48,
      ticks: 260,
      gravity: 0.9,
      scalar: 0.9,
      colors: GOLD_AND_IVORY,
    }
    const shots = [
      () => confetti({ ...volley, angle: 60, origin: { x: 0, y: 0.85 } }),
      () => confetti({ ...volley, angle: 120, origin: { x: 1, y: 0.85 } }),
      () =>
        confetti({ ...volley, particleCount: 90, spread: 100, startVelocity: 38, origin: winner }),
    ]
    shots.forEach((shot, i) =>
      setTimeout(() => {
        if (!cancelled()) shot()
      }, i * 260),
    )
  })
}

/**
 * Celebrates the winner: returns a ref for the element that shows them. The
 * first time that element is on screen, once per page load, it plays the
 * crowning (crowning.ts), ending in confetti. Viewers who prefer reduced
 * motion get neither.
 */
export function useConfetti(active: boolean) {
  const [target, setTarget] = useState<Element | null>(null)
  const fired = useRef(false)

  useEffect(() => {
    if (!active || !target || fired.current) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let cancelled = false
    let stop = () => {}

    // Marked only once it starts: StrictMode cancels the first run of every
    // effect in development, and the re-run must still be allowed to play.
    const begin = () => {
      if (cancelled || fired.current) return
      fired.current = true
      const { basePath } = getConfig()
      stop = crown(target, () => burst(target, () => cancelled), {
        fanfare: cue(`${basePath}audio/crowning.m4a`, { volume: 0.6, fadeIn: 300, loop: true }),
      })
    }

    if (typeof IntersectionObserver === 'undefined') {
      const soon = setTimeout(begin, 0)
      return () => {
        cancelled = true
        clearTimeout(soon)
        stop()
      }
    }
    const watch = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          watch.disconnect()
          begin()
        }
      },
      { threshold: 0.5 },
    )
    watch.observe(target)
    return () => {
      cancelled = true
      watch.disconnect()
      stop()
    }
  }, [active, target])

  return setTarget
}
