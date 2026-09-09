import { expect, test, type Page } from '@playwright/test'
import { resetDemo, weekShape } from './helpers'

/**
 * The header's week control drives the slate. Week 1 has all 32 teams playing;
 * later weeks have byes, and a team on bye must be named rather than simply
 * missing from the grid — "where are the Lions?" is the question this answers.
 */
test.describe('week selector', () => {
  test.beforeEach(async ({ page }) => {
    await resetDemo(page)
  })

  const select = (page: Page) =>
    page.getByLabel('Show a week').filter({ visible: true }).first()

  test('offers every week of the season and marks the live one', async ({ page }) => {
    const options = select(page).locator('option')
    await expect(options).toHaveCount(18)
    await expect(options.first()).toHaveText(/week 1 • now/i)
    await expect(options.last()).toHaveText(/week 18/i)
  })

  // A regex, not a string: Playwright trims a hasText string, so ' at ' would
  // also match "Patriots" in the bye list.
  const MATCHUP = /\sat\s/

  test('changing the week changes the slate', async ({ page }) => {
    // Week 1 opens with the Patriots at the Seahawks.
    await expect(page.getByRole('heading', { name: /slate/i })).toHaveText(/this week’s slate/i)
    const slate = page.locator('section[aria-labelledby="slate-title"]')
    await expect(slate).toContainText(/patriots/i)

    await select(page).selectOption('11')
    await expect(page).toHaveURL(/[?&]week=11/)
    await expect(page.getByRole('heading', { name: /slate/i })).toHaveText(/week 11 slate/i)
    // Week 11 is a bye week, so it is shorter than week 1's full sixteen.
    const shape = weekShape(11)
    expect(shape.games).toBeLessThan(weekShape(1).games)
    await expect(slate.getByRole('listitem').filter({ hasText: MATCHUP })).toHaveCount(shape.games)
  })

  test('names the teams on bye, and says none in a full week', async ({ page }) => {
    // Every team plays in week 1, so there is nothing to report.
    expect(weekShape(1).byes).toBe(0)
    await expect(page.getByRole('heading', { name: /on bye/i })).toHaveCount(0)

    await select(page).selectOption('11')
    const heading = page.getByRole('heading', { name: /on bye/i })
    await expect(heading).toBeVisible()
    await expect(heading).toHaveText(new RegExp(`${weekShape(11).byes} teams`, 'i'))
    // Named, not merely absent: "where are the Patriots?" has an answer.
    const slate = page.locator('section[aria-labelledby="slate-title"]')
    await expect(slate.getByRole('listitem').filter({ hasText: /^patriots$/i })).toHaveCount(1)
    await expect(page.getByText(/cannot be picked this week/i)).toBeVisible()
  })

  test('the hero keeps reporting the live week, not the one being browsed', async ({ page }) => {
    const hero = page.locator('section[aria-labelledby="hero-title"]')
    await select(page).selectOption('14')
    // Next kickoff and the pick deadline belong to week 1, which is still open.
    await expect(hero).toContainText(/next kickoff/i)
    await expect(hero).toContainText(/picks lock/i)
    await expect(hero.getByRole('heading', { level: 1 })).toHaveText(/^week 1$/i)
  })

  test('a week link survives a reload and a bad one falls back', async ({ page }) => {
    await page.goto('./#/?week=7')
    await expect(page.getByRole('heading', { name: /slate/i })).toHaveText(/week 7 slate/i)
    await page.reload()
    await expect(page.getByRole('heading', { name: /slate/i })).toHaveText(/week 7 slate/i)

    await page.goto('./#/?week=99')
    await expect(page.getByRole('heading', { name: /slate/i })).toHaveText(/this week’s slate/i)
  })
})
