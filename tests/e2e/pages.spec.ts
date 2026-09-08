import { expect, test } from '@playwright/test'
import { resetDemo } from './helpers'

/**
 * GitHub Pages behaviour under a repository subpath (/Survivor/), served by
 * scripts/serve-static.mjs which returns real 404s like Pages does.
 */

test.describe('GitHub Pages subpath hosting', () => {
  test('the app boots from the repository subpath with every asset resolved', async ({ page }) => {
    const failed: string[] = []
    page.on('response', (r) => {
      if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`)
    })
    await resetDemo(page)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/week 4/i)
    await expect(page.getByRole('img', { name: /headshot of marcus bell/i }).first()).toBeVisible()
    expect(failed, 'no asset may 404 under the subpath').toEqual([])
  })

  test('refreshing a nested hash route keeps the page', async ({ page }) => {
    await resetDemo(page)
    await page.goto('./#/players/marcus-bell')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/marcus bell/i)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/marcus bell/i)
    expect(page.url()).toContain('/Survivor/#/players/marcus-bell')
  })

  test('a clean deep link is rewritten by 404.html into the hash route', async ({ page }) => {
    await page.goto('./leaderboard')
    await expect(page).toHaveURL(/\/Survivor\/#\/leaderboard$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/leaderboard/i)
  })

  test('unknown routes render the in-app not-found page', async ({ page }) => {
    await page.goto('./#/nowhere')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/page not found/i)
  })
})
