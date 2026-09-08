import type { Page } from '@playwright/test'

/**
 * Demo-mode helpers. The demo clock is pinned (see src/data/demo/clock.ts),
 * so every run sees the same week 4 with weeks 1–3 resolved.
 */

export async function resetDemo(page: Page): Promise<void> {
  await page.goto('./')
  await page.evaluate(() => {
    localStorage.clear()
  })
}

export async function signInAs(page: Page, name: string): Promise<void> {
  await page.goto('./#/sign-in')
  await page.getByRole('button', { name: new RegExp(name, 'i') }).click()
  await page.waitForURL(/#\/me/)
}

export const PLAYER = 'Marcus Bell'
export const COMMISSIONER = 'Danny Okafor'
