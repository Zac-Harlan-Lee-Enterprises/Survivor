import { expect, test } from '@playwright/test'
import { resetDemo } from './helpers'

/**
 * The rulebook has to be reachable from anywhere in the app without knowing a
 * URL. It is rendered from docs/survivor-rules.md — the same document the rules
 * engine is tested against — so these tests also catch the rules page quietly
 * losing content if that document grows Markdown the renderer cannot read.
 */
test.describe('official rules', () => {
  test.beforeEach(async ({ page }) => {
    await resetDemo(page)
  })

  // Desktop has a top nav, mobile a bottom bar; both must carry the link.
  test('the nav reaches the rulebook at any screen size', async ({ page }) => {
    await page.getByRole('link', { name: /^rules$/i }).filter({ visible: true }).first().click()
    await expect(page).toHaveURL(/#\/rules$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/official rules/i)
  })

  test('the footer links to the rules from every page', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === 'mobile',
      'the footer is desktop-only; on mobile the bottom bar carries the link',
    )
    await page.goto('./#/leaderboard')
    await page.getByRole('contentinfo').getByRole('link', { name: /official rules/i }).click()
    await expect(page).toHaveURL(/#\/rules$/)
  })

  test('shows the rules that decide a season, including the outcome table', async ({ page }) => {
    await page.goto('./#/rules')
    const body = page.locator('main')
    await expect(body).toContainText(/one team to win/i)
    await expect(body).toContainText(/third miss eliminates/i)
    await expect(body).toContainText(/cannot be reused/i)
    await expect(body).toContainText(/commissioner is not exempt/i)
    // The game-situation table renders as a table, not as pipe characters.
    await expect(body.getByRole('table')).toBeVisible()
    await expect(body.getByRole('columnheader', { name: /pick outcome/i })).toBeVisible()
    expect(await body.innerText()).not.toContain('|---')
  })

  test('states this league’s live settings, not just the defaults', async ({ page }) => {
    await page.goto('./#/rules')
    const facts = page.getByRole('main').locator('dl')
    await expect(facts).toContainText('3') // lives
    await expect(facts).toContainText(/5 min before the first kickoff/i)
    await expect(facts).toContainText(/costs a life/i)
    await expect(facts).toContainText(/C[SD]T/) // league timezone, America/Chicago
  })

  // League members are not maintainers: the page must read as a rulebook.
  test('shows no engineering notes', async ({ page }) => {
    await page.goto('./#/rules')
    const body = (await page.getByRole('main').innerText()).toLowerCase()
    for (const jargon of ['determinism', 'evaluateseason', 'randomness', 'src/domain']) {
      expect(body, jargon).not.toContain(jargon)
    }
  })

  test('a deep link to the rules survives a reload', async ({ page }) => {
    await page.goto('./#/rules')
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/official rules/i)
  })
})
