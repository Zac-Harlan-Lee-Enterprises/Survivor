import { expect, test } from '@playwright/test'
import { COMMISSIONER, PLAYER, resetDemo, setDemoClock, signInAs } from './helpers'

test.describe('commissioner workflow (demo mode)', () => {
  test.beforeEach(async ({ page }) => {
    await resetDemo(page)
    await signInAs(page, COMMISSIONER)
  })

  test('players who are not the commissioner cannot open the dashboard', async ({ page }) => {
    await page.getByRole('button', { name: /sign out/i }).click()
    await signInAs(page, PLAYER)
    await page.goto('./#/commissioner')
    await expect(page).toHaveURL(/\/Survivor\/#\/$/)
  })

  test('adds a player and records the addition in the audit log', async ({ page }) => {
    await page.goto('./#/commissioner/players')
    await page.getByLabel('Name', { exact: true }).fill('Jordan Lee')
    await page.getByRole('button', { name: /add player/i }).click()
    await expect(page.getByRole('status')).toContainText(/jordan lee added with 3 lives/i)

    await page.goto('./')
    await expect(page.getByRole('heading', { name: /still standing/i })).toContainText('10')
    await page.goto('./#/commissioner/audit')
    await expect(page.getByText(/jordan lee joined the league/i)).toBeVisible()
  })

  test('entering a real result costs the losing players a life and recalculates standings', async ({
    page,
  }) => {
    // Dave Johnson and James Parker both ride the Lions (NO at DET in the real
    // week 1 schedule); make that game a loss for Detroit.
    await page.goto('./#/commissioner/results')
    const row = page.getByRole('listitem').filter({ hasText: /DET/ }).first()
    await row.getByRole('button', { name: /enter result/i }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel(/^DET score/).fill('13')
    await dialog.getByLabel(/^NO score/).fill('27')
    await dialog.getByLabel(/reason/i).fill('final score from the broadcast')
    await dialog.getByRole('button', { name: /record result/i }).click()
    await expect(dialog.getByRole('status')).toContainText(/standings recalculated/i)
    await page.keyboard.press('Escape')

    // Both Lions backers drop to two lives; nobody else is touched.
    await page.goto('./#/leaderboard')
    for (const name of ['Dave Johnson', 'James Parker']) {
      const entry = page.getByRole('listitem').filter({ hasText: name }).first()
      await expect(entry).toContainText('1/3')
      await expect(entry.getByRole('img', { name: /2 of 3 lives remaining/i })).toBeVisible()
    }
    const untouched = page.getByRole('listitem').filter({ hasText: 'Sheila Acker' }).first()
    await expect(untouched).toContainText('0/3')

    await page.goto('./#/commissioner/audit')
    await expect(page.getByText(/final score from the broadcast/i).first()).toBeVisible()
  })

  test('imports spreadsheet picks with a report that flags problems before anything is committed', async ({
    page,
  }) => {
    await page.goto('./#/commissioner/import')
    await page
      .getByLabel('CSV', { exact: true })
      .fill('Player,Week 1\nMaya Israel,Los Angeles\nNobody Known,GB\n')
    await page.getByRole('button', { name: /^analyze$/i }).click()
    await expect(page.getByText(/AMBIGUOUS_TEAM/)).toBeVisible()
    await expect(page.getByText(/no league member matches "nobody known"/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /import \d+ pick/i })).toBeDisabled()

    await page.getByLabel('CSV', { exact: true }).fill('Player,Week 1\nMaya Israel,Chargers\n')
    await page.getByRole('button', { name: /^analyze$/i }).click()
    await expect(page.getByText(/clean import/i)).toBeVisible()
    await page.getByRole('button', { name: /import 1 pick/i }).click()
    await expect(page.getByRole('status')).toContainText(/1 picks imported/i)
  })

  test('sets a pick for a player after kickoff, which a player could not do themselves', async ({
    page,
  }) => {
    await setDemoClock(page, '2026-09-13T18:00')
    await page.goto('./#/commissioner/picks')
    const row = page.getByRole('listitem').filter({ hasText: 'Sheila Acker' })
    await row.getByRole('button', { name: /set/i }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Team').selectOption('DET')
    await dialog.getByLabel('Reason').fill('texted her pick before kickoff')
    await dialog.getByRole('button', { name: /save pick/i }).click()
    await expect(dialog.getByRole('status')).toContainText(/set to detroit lions/i)
    await page.keyboard.press('Escape')

    await page.goto('./#/commissioner/audit')
    await expect(page.getByText(/texted her pick before kickoff/i).first()).toBeVisible()
  })

  test('the demo clock moves the league forward and locks the week', async ({ page }) => {
    await setDemoClock(page, '2026-09-15T12:00')
    await page.goto('./')
    await expect(page.getByText(/every game this week has kicked off/i)).toBeVisible()
    await page.goto('./#/pick')
    await expect(page.getByText(/kicked off .* locked/i)).toBeVisible()
  })
})
