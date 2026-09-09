import { expect, test } from '@playwright/test'

/**
 * The bundle exactly as GitHub Pages serves it.
 *
 * In demo mode nothing a visitor does can reach anyone else, so the published
 * site must not offer to take a pick. These tests assert the absence of every
 * write affordance — the failure they guard against is a league member tapping
 * "Make my pick", believing they have entered, and silently not being in.
 */
test.describe('published site offers no way to pick', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
  })

  test('the league still reads correctly', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/week \d+/i)
    await expect(page.getByRole('heading', { name: /still standing/i })).toContainText('9')
    await expect(page.getByRole('img', { name: /headshot of maya israel/i }).first()).toBeVisible()
    // Read-only pages remain reachable.
    for (const [name, path] of [
      ['leaderboard', './#/leaderboard'],
      ['grid', './#/grid'],
      ['profile', './#/players/maya-israel'],
    ] as const) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 }), name).toBeVisible()
    }
  })

  test('no sign-in, no Pick, no Me anywhere in the chrome', async ({ page }) => {
    await expect(page.getByRole('button', { name: /sign in/i })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /^sign in$/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /sign out/i })).toHaveCount(0)
    const nav = page.getByRole('navigation', { name: /primary/i }).first()
    await expect(nav.getByRole('link', { name: /^pick$/i })).toHaveCount(0)
    await expect(nav.getByRole('link', { name: /^me$/i })).toHaveCount(0)
    await expect(nav.getByRole('link', { name: /^league$/i })).toBeVisible()
    await expect(nav.getByRole('link', { name: /^board$/i })).toBeVisible()
    await expect(nav.getByRole('link', { name: /^grid$/i })).toBeVisible()
  })

  test('no call to action invites a pick', async ({ page }) => {
    const body = await page.locator('body').innerText()
    for (const phrase of ['make my pick', 'review my pick', 'change my pick', 'sign in to pick']) {
      expect(body.toLowerCase(), phrase).not.toContain(phrase)
    }
    await expect(page.getByRole('link', { name: /make a pick/i })).toHaveCount(0)
  })

  test('typing a write route in the address bar lands on the league, not a dead end', async ({
    page,
  }) => {
    for (const route of ['pick', 'me', 'my-season', 'sign-in', 'commissioner']) {
      await page.goto(`./#/${route}`)
      await expect(page, route).toHaveURL(/\/Survivor\/#\/$/)
      await expect(page.getByRole('heading', { level: 1 })).toContainText(/week \d+/i)
    }
  })

  test('the local-editing banner is absent, since nothing here is editable', async ({ page }) => {
    await expect(page.getByRole('note')).toHaveCount(0)
    expect((await page.locator('body').innerText()).toLowerCase()).not.toContain(
      'commissioner mode',
    )
  })
})
