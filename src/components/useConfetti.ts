import { useEffect, useRef, useState } from 'react'
import type confettiLib from 'canvas-confetti'
import type { PlayerStanding } from '@/domain'
import { crown, type Laurel, type TrophyFilm } from './crowning'
import TROPHY from './trophyFrames.json'
import { fireworks, flashes } from './finale'
import { cue } from './music'
import { getConfig } from '@/config/env'
import { useLeagueContext } from '@/app/hooks'

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
 * A winner's season as their wreath: every team they picked, in week order,
 * the weeks that cost a life greyed. (A cancelled game's pick went back to
 * the pool, so it is not in it. By the time anyone is crowned every week is
 * settled; a pick still waiting on its game counts as standing.)
 */
export function wreathOf(s: PlayerStanding, basePath: string): Laurel[] {
  return s.history
    .filter((h) => h.pick && h.outcome !== 'void')
    .map((h) => ({
      src: `${basePath}team-logos/${h.pick!.teamId.toLowerCase()}.png`,
      won: h.outcome !== 'loss' && h.outcome !== 'tie',
    }))
}

/** After the confetti: the photographers, then the fireworks (finale.ts). */
const FIREWORKS_AFTER = 1300

/**
 * Celebrates the winners: returns a ref for the element that shows them, in
 * the order given. The first time that element is on screen, once per page
 * load, it plays the crowning (crowning.ts) with each winner's season as a
 * wreath, ending in confetti, camera flashes and fireworks — `after` ms
 * once it is seen (the league home lets its banner unroll first). Viewers
 * who prefer reduced motion get none of it.
 */
export function useConfetti(winners: readonly PlayerStanding[], { after = 0 } = {}) {
  const { profileOf } = useLeagueContext()
  const [target, setTarget] = useState<Element | null>(null)
  const fired = useRef(false)
  const active = winners.length > 0
  // (As a string, not the array: a re-render must not restart the scene.)
  const wreaths = JSON.stringify(winners.map((w) => wreathOf(w, getConfig().basePath)))
  // The name for the trophy's plaque.
  const engraved = winners.map((w) => profileOf(w.playerId).displayName).join(' & ')

  useEffect(() => {
    if (!active || !target || fired.current) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let cancelled = false
    let stop = () => {}
    let wait: ReturnType<typeof setTimeout> | undefined
    const encores: (() => void)[] = []

    // Marked only once it starts: StrictMode cancels the first run of every
    // effect in development, and the re-run must still be allowed to play.
    const begin = () => {
      if (cancelled || fired.current) return
      fired.current = true
      const { basePath } = getConfig()
      const doc = target.ownerDocument
      const finale = () => {
        burst(target, () => cancelled)
        encores.push(flashes(doc))
        const later = setTimeout(() => {
          if (!cancelled) encores.push(fireworks(doc))
        }, FIREWORKS_AFTER)
        encores.push(() => clearTimeout(later))
      }
      const scene = crown(target, finale, {
        fanfare: cue(`${basePath}audio/crowning.m4a`, { volume: 0.6, fadeIn: 300, loop: true }),
        wreaths: JSON.parse(wreaths) as Laurel[][],
        trophy: { film: TROPHY as TrophyFilm, src: `${basePath}${TROPHY.sheet}`, name: engraved },
      })
      stop = () => {
        scene()
        encores.splice(0).forEach((end) => end())
      }
    }

    if (typeof IntersectionObserver === 'undefined') {
      wait = setTimeout(begin, after)
      return () => {
        cancelled = true
        clearTimeout(wait)
        stop()
      }
    }
    const watch = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          watch.disconnect()
          if (after) wait = setTimeout(begin, after)
          else begin()
        }
      },
      { threshold: 0.5 },
    )
    watch.observe(target)
    return () => {
      cancelled = true
      clearTimeout(wait)
      watch.disconnect()
      stop()
    }
  }, [active, target, wreaths, after, engraved])

  return setTarget
}
