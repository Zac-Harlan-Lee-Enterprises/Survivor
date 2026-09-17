import { expect, test } from '@playwright/test'
import {
  COMMISSIONER,
  PLAYER,
  resetDemo,
  ROSTER_SIZE,
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
    await expect(page.getByRole('heading', { name: /still standing/i })).toContainText(
      String(ROSTER_SIZE),
    )
    for (const name of [PLAYER, COMMISSIONER, 'Sheila Acker', 'Stacey Markendorff']) {
      await expect(page.getByRole('link', { name: new RegExp(name, 'i') }).first()).toBeVisible()
    }
    // Nobody has played yet, so there is no bubble and no graveyard to show.
    await expect(page.getByRole('heading', { name: /living dangerously/i })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: /graves|graveyard/i })).toHaveCount(0)
  })

  test('a player does not see rivals’ picks before the deadline (regression)', async ({
    page,
    isMobile,
  }) => {
    // Reported bug: the season grid showed everyone's pick while the week was
    // still open — an information advantage, not just a display slip.
    //
    // This asserts it for a PLAYER, which is the case that must hold wherever
    // the league is hosted. The commissioner is deliberately exempt in local
    // commissioner mode (one browser, their own machine, readable by nobody
    // else); see the local-reveal tests in src/data/demo/reveal.test.ts, which
    // pin both sides of that gate, and the admin-panel test below.
    await signInAs(page, PLAYER)
    await page.goto('./#/grid')

    // Both layouts sit in the DOM and only one is shown, so scope to the
    // visible one: a hidden desktop cell would otherwise satisfy the assertion.
    // Dave Johnson rides the Lions; his pick is the one that must not leak.
    let scope = page.getByRole('table')
    if (isMobile) {
      await expect(scope).toBeHidden()
      const card = page.locator('details').filter({ hasText: 'Dave Johnson' }).first()
      await card.locator('summary').click()
      scope = card
    }
    await expect(scope).toBeVisible()
    await expect(scope.getByLabel(/detroit lions:/i)).toHaveCount(0)
    await expect(scope.getByLabel(/hidden until the pick deadline/i).first()).toBeVisible()

    // The leaderboard and league home must not leak it either.
    await page.goto('./#/leaderboard')
    const row = page.getByRole('listitem').filter({ hasText: 'Dave Johnson' }).first()
    await expect(row).toContainText(/locked in/i)
    await expect(row).not.toContainText(/DET/)
  })

  test('the admin picks panel shows picks by default in local commissioner mode, and still toggles', async ({
    page,
  }) => {
    // Local mode is one browser on the commissioner's own machine: nobody else
    // can read this league, so collapsing the panel protects no one and only
    // adds a click to transcribing the week's replies. A deployed league keeps
    // the collapse — see the grid regression test above, which still asserts
    // that nothing leaks into any player-facing view.
    await signInAs(page, COMMISSIONER)
    await page.goto('./#/commissioner/picks')
    const daveRow = page.getByRole('listitem').filter({ hasText: 'Dave Johnson' }).first()
    await expect(daveRow).toContainText(/detroit lions/i)
    await expect(page.getByRole('alert')).toContainText(/only in this browser/i)

    // The toggle still works in both directions.
    await page.getByRole('button', { name: /hide picks/i }).click()
    await expect(daveRow).not.toContainText(/detroit lions/i)
    await expect(page.getByRole('status')).toContainText(/picks stay concealed here too/i)

    await page.getByRole('button', { name: /reveal picks/i }).click()
    await expect(daveRow).toContainText(/detroit lions/i)
  })

  test('signing in as a player shows that player exactly what they may see', async ({ page }) => {
    const card = (name: string) =>
      page.getByRole('link', { name: new RegExp(`${name}: `, 'i') }).first()

    // These run in LOCAL commissioner mode, where signed out and commissioner
    // are both the operator looking at their own machine, so both see
    // everything. Concealment for those two is asserted against the published
    // build in src/data/demo/reveal.test.ts, where the flag is off.
    await expect(card(PLAYER)).toContainText(/riding jaguars/i)

    // Signing in AS A PLAYER is the deliberate question "what does this person
    // see?", and the honest answer conceals their rivals. That is the
    // guarantee that has to hold wherever the league is hosted.
    await signInAs(page, PLAYER)
    await page.goto('./')
    await expect(card(PLAYER)).toContainText(/riding jaguars/i)
    await expect(card('Sheila Acker')).toContainText(/locked in/i)
    await expect(card('Sheila Acker')).not.toContainText(/buccaneers|riding/i)

    await page.getByRole('button', { name: /sign out/i }).click()
    await signInAs(page, COMMISSIONER)
    await page.goto('./')
    await expect(card('Sheila Acker')).toContainText(/riding/i)
    await expect(card('Dominic Green')).toContainText(/riding/i)
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

  test('the whole league locks at one deadline, and picks become public', async ({ page }) => {
    await signInAs(page, COMMISSIONER)
    await setDemoClock(page, SUNDAY_AFTERNOON)

    // Zac rides the Chargers, who do not kick off until 20:25Z — but the
    // deadline passed before the first game, so his pick is locked too.
    await page.goto('./#/pick')
    await expect(page.getByText(/locked/i).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /^detroit lions/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^los angeles chargers/i })).toHaveCount(0)

    // Maya's pick is locked as well, and every pick is now public.
    await page.getByRole('button', { name: /sign out/i }).click()
    await page.goto('./')
    await expect(page.getByRole('link', { name: /dave johnson: /i }).first()).toContainText(
      /riding lions/i,
    )
    await expect(page.getByRole('link', { name: /zac harlan: /i }).first()).toContainText(
      /riding chargers/i,
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
