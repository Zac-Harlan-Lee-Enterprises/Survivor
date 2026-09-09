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
  await page.goto('./')
  await page.evaluate(() => localStorage.clear())
  // First reload lets the app write its seed fingerprint; a pin set before that
  // would be wiped by the stale-overlay guard.
  await page.reload()
  await page.evaluate((pin) => localStorage.setItem('survivor:demo:clock:v1', pin), CLOCK_PIN)
  await page.reload()
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
) as { memberships: { status: string }[] }

export const ROSTER_SIZE = fixture.memberships.filter((m) => m.status === 'active').length

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
