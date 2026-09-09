import { expect, test } from '@playwright/test'
import {
  COMMISSIONER,
  PLAYER,
  resetDemo,
  setDemoClock,
  signInAs,
  SUNDAY_AFTERNOON,
} from './helpers'

test.describe('player workflow (demo mode, no backend)', () => {
  test.beforeEach(async ({ page }) => {
    await resetDemo(page)
  })

  test('league home shows the whole roster alive with three lives in week 1', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/week 1/i)
    await expect(page.getByRole('heading', { name: /still standing/i })).toContainText('9')
    for (const name of [PLAYER, COMMISSIONER, 'Sheila Acker', 'Stacey Markendorff']) {
      await expect(page.getByRole('link', { name: new RegExp(name, 'i') }).first()).toBeVisible()
    }
    // Nobody has played yet, so there is no bubble and no graveyard to show.
    await expect(page.getByRole('heading', { name: /living dangerously/i })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: /graves|graveyard/i })).toHaveCount(0)
  })

  test('other players’ picks stay hidden until kickoff, and the commissioner sees them all', async ({
    page,
  }) => {
    const card = (name: string) =>
      page.getByRole('link', { name: new RegExp(`${name}: `, 'i') }).first()
    // Signed out: every pick is locked in but concealed.
    await expect(card(PLAYER)).toContainText(/locked in/i)
    await expect(card(PLAYER)).not.toContainText(/jaguars/i)

    await signInAs(page, PLAYER)
    await page.goto('./')
    await expect(card(PLAYER)).toContainText(/riding jaguars/i)
    await expect(card('Sheila Acker')).toContainText(/locked in/i)

    await page.getByRole('button', { name: /sign out/i }).click()
    await signInAs(page, COMMISSIONER)
    await page.goto('./')
    await expect(card('Sheila Acker')).toContainText(/riding seahawks/i)
    await expect(card('Dominic Green')).toContainText(/riding ravens/i)
  })

  test('a player reviews and changes a pick before kickoff', async ({ page }) => {
    await signInAs(page, PLAYER)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/maya israel/i)
    await expect(page.getByText(/still alive/i).first()).toBeVisible()
    await page.getByRole('link', { name: /change my pick/i }).click()
    await expect(page.getByRole('status')).toContainText(
      /you are riding with jacksonville jaguars in week 1/i,
    )

    // Week 1: nothing used, nothing on bye, nothing kicked off — all 32 available.
    await expect(page.getByRole('heading', { name: /^available/i })).toContainText('32')
    await expect(page.getByRole('heading', { name: /already used/i })).toHaveCount(0)

    await page.getByRole('button', { name: /^philadelphia eagles/i }).click()
    await expect(page.getByRole('dialog')).toContainText(
      /riding with philadelphia eagles in week 1/i,
    )
    await page.getByRole('button', { name: /change my pick/i }).click()
    await expect(page.getByRole('status')).toContainText(/philadelphia eagles/i)

    // Persisted across a reload.
    await page.goto('./#/me')
    await expect(page.getByText(/philadelphia eagles/i).first()).toBeVisible()
  })

  test('a pick locks once its own game kicks off, while a later game stays open', async ({
    page,
  }) => {
    await signInAs(page, COMMISSIONER)
    await setDemoClock(page, SUNDAY_AFTERNOON)

    // Zac rides the Chargers, who kicked off at 17:00Z — locked.
    await page.goto('./#/pick')
    await expect(page.getByText(/kicked off .* locked/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /^detroit lions/i })).toHaveCount(0)

    // Maya rides the Jaguars, who kick off later — still changeable.
    await page.getByRole('button', { name: /sign out/i }).click()
    await signInAs(page, PLAYER)
    await page.goto('./#/pick')
    await expect(page.getByRole('status')).toContainText(/jacksonville jaguars/i)
    await expect(page.getByRole('heading', { name: /already kicked off/i })).toBeVisible()
    await expect(page.getByLabel(/detroit lions: kicked off/i)).toBeVisible()

    // Locked picks are now public to everyone.
    await page.getByRole('button', { name: /sign out/i }).click()
    await page.goto('./')
    await expect(page.getByRole('link', { name: /dave johnson: /i }).first()).toContainText(
      /riding lions/i,
    )
  })

  test('the season grid and my-season pages show week 1', async ({ page, isMobile }) => {
    await signInAs(page, COMMISSIONER)
    await page.goto('./#/grid')
    // The desktop table and the mobile cards are both in the DOM; only one is
    // shown, so scope the cell lookup to whichever is visible at this width.
    let grid = page.getByRole('table')
    if (isMobile) {
      await expect(grid).toBeHidden()
      const card = page.locator('details').filter({ hasText: 'Zac Harlan' })
      await card.locator('summary').click()
      grid = card
    } else {
      await expect(grid).toBeVisible()
    }
    await expect(grid.getByLabel(/los angeles chargers: pending/i).first()).toBeVisible()

    await page.goto('./#/my-season')
    await expect(page.getByRole('heading', { name: /^available this week/i })).toContainText('32')
    await expect(page.getByRole('heading', { name: /already used/i })).toContainText('0')
    await expect(page.getByText(/los angeles chargers/i).first()).toBeVisible()
  })

  test('works on a phone: bottom navigation reaches the pick screen', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'mobile project only')
    await signInAs(page, PLAYER)
    await page
      .getByRole('navigation', { name: /primary mobile/i })
      .getByRole('link', { name: /pick/i })
      .click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/make your pick/i)
  })
})
