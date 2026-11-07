import { expect, test, type Page } from '@playwright/test'
import { COMMISSIONER, resetDemo, signInAs } from './helpers'

/** The commissioner crowns the first player listed; returns their name. */
async function crownSomeone(page: Page): Promise<string> {
  await page.goto('./#/commissioner/settings')
  const box = page.locator('input[name=champion]').first()
  const label = (await box.locator('xpath=..').innerText()).replace(/\(.*\)/, '').trim()
  await box.check()
  await page.locator('#dc-reason').fill('season over')
  await page.getByRole('button', { name: /record decision/i }).click()
  await expect(page.getByText(/champion recorded/i)).toBeVisible()
  return label
}

test.describe('the champion', () => {
  // The scene itself is motion; these check what stays when it is over.
  test.use({ reducedMotion: 'reduce' })

  test.beforeEach(async ({ page }) => {
    await resetDemo(page)
  })

  test('before anyone wins, the Hall of Champions waits for its first banner', async ({ page }) => {
    await page.goto('./#/champions')
    await expect(page.getByRole('heading', { name: 'Hall of Champions' })).toBeVisible()
    await expect(page.getByText(/no banners yet/i)).toBeVisible()
    await expect(page.getByRole('img', { name: 'Champion' })).toHaveCount(0)
  })

  test('hangs a banner on the home page with a citation, crowns their headshot everywhere, and hangs it in the hall', async ({
    page,
  }) => {
    await signInAs(page, COMMISSIONER)
    const name = await crownSomeone(page)

    await page.goto('./')
    const banner = page.getByRole('figure', { name: new RegExp(`2026 champion: ${name}`, 'i') })
    await expect(banner).toBeVisible()
    await expect(page.getByText(new RegExp(`${name} outlasted .* of us`))).toBeVisible()
    await page.getByRole('main').getByRole('link', { name: 'Hall of Champions' }).click()
    await expect(page).toHaveURL(/#\/champions/)
    await expect(page.getByRole('figure', { name: new RegExp(name, 'i') })).toBeVisible()

    await page.goto('./#/leaderboard')
    const champion = page.getByRole('region', { name: /champion/i })
    await expect(champion.getByRole('img', { name: 'Champion' })).toBeVisible()
  })
})
