import type { Page } from '@playwright/test'

/**
 * Demo-mode helpers. The demo clock is pinned (see src/data/demo/clock.ts) to
 * the Wednesday before week 1, so every run starts from the same state: all
 * nine picks in, nothing kicked off, everyone holding three lives.
 */

export async function resetDemo(page: Page): Promise<void> {
  await page.goto('./')
  await page.evaluate(() => {
    localStorage.clear()
  })
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

export const PLAYER = 'Maya Israel'
export const COMMISSIONER = 'Zac Harlan'

/** Kickoff instants baked into the synthetic week 1 schedule. */
export const BEFORE_KICKOFF = '2026-09-09T16:00'
/** Sunday afternoon: BAL/DET/LAC/SEA have kicked off, the JAX game has not. */
export const SUNDAY_AFTERNOON = '2026-09-13T18:00'
