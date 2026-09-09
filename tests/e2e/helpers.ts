import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'

/**
 * Demo-mode helpers. The demo clock is pinned (see src/data/demo/clock.ts) to
 * the Wednesday before week 1, so every run starts from the same state: every
 * pick in, nothing kicked off, everyone holding three lives.
 */

/**
 * Clears the browser overlay and PINS the demo clock. The app runs on real time
 * by default (the schedule is real), so without pinning these tests would drift
 * the moment week 1 actually kicks off.
 */
export async function resetDemo(page: Page): Promise<void> {
  await stubEspnOffline(page)
  await page.goto('./')
  await page.evaluate(() => localStorage.clear())
  // First reload lets the app write its seed fingerprint; a pin set before that
  // would be wiped by the stale-overlay guard.
  await page.reload()
  await page.evaluate((pin) => localStorage.setItem('survivor:demo:clock:v1', pin), CLOCK_PIN)
  await page.reload()
}

/**
 * Makes the live-score feed unreachable, instantly.
 *
 * The league page polls ESPN through the real global fetch while a week is
 * being played. CI has no outbound network, so an unstubbed request would hang
 * until it times out — once per page view, doubled by the query client's retry.
 * Aborting fails it in a millisecond, which is exactly what a viewer offline
 * would get: the tiles keep showing the last thing known to be true.
 *
 * A spec that wants real scores registers its own route afterwards; the most
 * recently added route wins.
 */
export async function stubEspnOffline(page: Page): Promise<void> {
  await page.route('**/site.api.espn.com/**', (route) => route.abort())
}

/** Serves one ESPN scoreboard payload to the page, replacing the offline stub. */
export async function serveEspn(page: Page, payload: unknown): Promise<void> {
  await page.route('**/site.api.espn.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    }),
  )
}

export async function signInAs(page: Page, name: string): Promise<void> {
  await page.goto('./#/sign-in')
  await page.getByRole('button', { name: new RegExp(name, 'i') }).click()
  await page.waitForURL(/#\/me/)
}

/** Moves the pinned demo clock (commissioner only) to an exact UTC instant. */
export async function setDemoClock(page: Page, utcMinute: string): Promise<void> {
  await page.goto('./#/commissioner/settings')
  await page.getByLabel('Now (UTC)').fill(utcMinute)
  await page.getByRole('button', { name: /set clock/i }).click()
}

/**
 * Derived from the seeded fixture rather than hard-coded: adding a player to
 * the league should not require editing a pile of specs.
 *
 * Read from disk rather than imported: these specs run in Node, where a JSON
 * import needs an import attribute, and the file is data anyway.
 */
const fixture = JSON.parse(
  readFileSync(new URL('../../src/data/demo/fixtures/demo-season.json', import.meta.url), 'utf8'),
) as { memberships: { status: string }[]; games: { week: number }[] }

export const ROSTER_SIZE = fixture.memberships.filter((m) => m.status === 'active').length

/**
 * How many games a week has, and how many teams sit it out. Derived from the
 * seeded schedule so a schedule refresh cannot leave these numbers lying.
 * Byes are always even: 32 teams, two per game.
 */
export function weekShape(week: number): { games: number; byes: number } {
  const games = fixture.games.filter((g) => g.week === week).length
  return { games, byes: 32 - games * 2 }
}

export const PLAYER = 'Maya Israel'
export const COMMISSIONER = 'Zac Harlan'

/** Pinned "now" for every test: before any week 1 kickoff, so picks are open. */
export const CLOCK_PIN = '2026-09-09T16:00:00.000Z'
export const BEFORE_KICKOFF = '2026-09-09T16:00'
/**
 * Sunday afternoon of the real week 1: the 17:00Z games (JAX, BAL, DET) and
 * Thursday's SEA game have kicked off; the 20:25Z Chargers game has not.
 */
export const SUNDAY_AFTERNOON = '2026-09-13T18:00'
