/** The parts of `document` the loop needs, so a test can stand in for it. */
export interface Visibility {
  readonly hidden: boolean
  addEventListener(type: 'visibilitychange', listener: () => void): void
  removeEventListener(type: 'visibilitychange', listener: () => void): void
}

/**
 * Calls `poll` now and then every `pollMs` (or `backoffMs` after a failure),
 * for as long as the page is visible. Returns the function that stops it.
 *
 * There is only ever one chain. A poll that is still in the air when the tab is
 * hidden, or when it comes back, is not allowed to schedule a successor: each
 * run carries the generation it started in, and anything that changes the
 * visibility moves the generation on. (Without that, every hide and show during
 * a request added another loop that never ended.)
 */
export function startPollLoop(
  poll: () => Promise<void>,
  { pollMs, backoffMs, doc }: { pollMs: number; backoffMs: number; doc: Visibility },
): () => void {
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  const run = async () => {
    const mine = ++generation
    let wait = pollMs
    try {
      await poll()
    } catch {
      // The feed is unofficial and the viewer may simply be offline. Back off
      // and try again; there is nothing here for a reader to act on.
      wait = backoffMs
    }
    if (mine !== generation || doc.hidden) return
    timer = setTimeout(() => void run(), wait)
  }

  // A league page sits open all Sunday. Polling a tab nobody is looking at
  // burns a phone battery to update pixels no one can see.
  const onVisibility = () => {
    clearTimeout(timer)
    generation++
    if (!doc.hidden) void run()
  }

  if (!doc.hidden) void run()
  doc.addEventListener('visibilitychange', onVisibility)
  return () => {
    generation++
    clearTimeout(timer)
    doc.removeEventListener('visibilitychange', onVisibility)
  }
}
