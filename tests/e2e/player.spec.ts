import { expect, test } from '@playwright/test'
import { PLAYER, resetDemo, signInAs } from './helpers'

test.describe('player workflow (demo mode, no backend)', () => {
  test.beforeEach(async ({ page }) => {
    await resetDemo(page)
  })

  test('league home communicates who is still standing within seconds', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /still standing/i })).toContainText('9')
    await expect(page.getByRole('heading', { name: /living dangerously/i })).toBeVisible()
    await expect(
      page.getByRole('heading', { name: /fresh graves|survivor graveyard/i }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: /tom lindqvist/i }).first()).toContainText(
      /eliminated/i,
    )
    // A pick that already kicked off is visible; unlocked picks are not.
    await expect(page.getByRole('link', { name: /priya raman/i }).first()).toContainText(
      /riding chiefs/i,
    )
    await expect(page.getByRole('link', { name: /marcus bell/i }).first()).toContainText(
      /locked in/i,
    )
  })

  test('a player makes, confirms and changes a pick before kickoff', async ({ page }) => {
    await signInAs(page, 'Sofia Reyes')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/sofia reyes/i)
    await expect(page.getByText(/on the bubble/i).first()).toBeVisible()
    await page.getByRole('link', { name: /make my pick/i }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/make your pick/i)

    // Used teams are shown but not selectable; bye teams are grouped separately.
    await expect(page.getByRole('heading', { name: /already used/i })).toContainText('3')
    await expect(page.getByText(/used week 1/i).first()).toBeVisible()

    // Pick the Lions.
    await page.getByRole('button', { name: /^detroit lions/i }).click()
    await expect(page.getByRole('dialog')).toContainText(/riding with detroit lions in week 4/i)
    await page.getByRole('button', { name: /ride with them/i }).click()
    await expect(page.getByRole('status')).toContainText(
      /you are riding with detroit lions in week 4/i,
    )

    // Change to the Eagles.
    await page.getByRole('button', { name: /^philadelphia eagles/i }).click()
    await page.getByRole('button', { name: /change my pick/i }).click()
    await expect(page.getByRole('status')).toContainText(/philadelphia eagles/i)

    // Persisted: reload and the dashboard shows it.
    await page.goto('./#/me')
    await expect(page.getByText(/philadelphia eagles/i).first()).toBeVisible()
    // Other viewers see it as locked in (hidden) rather than the team.
    await page.getByRole('button', { name: /sign out/i }).click()
    await page.goto('./#/leaderboard')
    const row = page.getByRole('listitem').filter({ hasText: 'Sofia Reyes' }).first()
    await expect(row).toContainText(/locked in/i)
    await expect(row).not.toContainText(/PHI/)
  })

  test('a team already used this season cannot be picked again, even via the used list', async ({
    page,
  }) => {
    await signInAs(page, PLAYER)
    await page.goto('./#/pick')
    // Marcus used KC in week 1 — it renders as used, not as a button.
    const used = page.getByLabel(/kansas city chiefs: used week 1/i)
    await expect(used).toBeVisible()
    await expect(page.getByRole('button', { name: /kansas city chiefs/i })).toHaveCount(0)
  })

  test('the pick screen locks once the game has kicked off', async ({ page }) => {
    await signInAs(page, 'Priya Raman')
    await page.goto('./#/pick')
    await expect(page.getByText(/kicked off .* locked/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /^detroit lions/i })).toHaveCount(0)
  })

  test('the season grid and my-season pages show history with outcomes', async ({
    page,
    isMobile,
  }) => {
    await page.goto('./#/grid')
    let scope = page.getByRole('table')
    if (isMobile) {
      // Phones get one expandable card per player instead of the wide table.
      await expect(page.getByRole('table')).toBeHidden()
      const luis = page.locator('details').filter({ hasText: 'Luis Herrera' })
      const tom = page.locator('details').filter({ hasText: 'Tom Lindqvist' })
      await luis.locator('summary').click()
      await tom.locator('summary').click()
      scope = page.locator('details')
    } else {
      await expect(scope).toBeVisible()
    }
    await expect(scope.getByLabel(/denver broncos: tie/i).first()).toBeVisible()
    await expect(scope.getByLabel(/arizona cardinals: loss, eliminated/i).first()).toBeVisible()
    await signInAs(page, 'Hannah O')
    await page.goto('./#/my-season')
    await expect(page.getByRole('heading', { name: /already used/i })).toContainText('2')
    await expect(page.getByText(/no pick/i).first()).toBeVisible()
  })

  test('works on a phone: bottom navigation reaches the pick screen', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'mobile project only')
    await signInAs(page, 'Emily Chen')
    await page
      .getByRole('navigation', { name: /primary mobile/i })
      .getByRole('link', { name: /pick/i })
      .click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/make your pick/i)
  })
})
