import { expect, test } from '@playwright/test'
import { COMMISSIONER, resetDemo, signInAs } from './helpers'

test.describe('commissioner workflow (demo mode)', () => {
  test.beforeEach(async ({ page }) => {
    await resetDemo(page)
    await signInAs(page, COMMISSIONER)
  })

  test('players who are not the commissioner cannot open the dashboard', async ({ page }) => {
    await page.getByRole('button', { name: /sign out/i }).click()
    await signInAs(page, 'Emily Chen')
    await page.goto('./#/commissioner')
    await expect(page).toHaveURL(/\/Survivor\/#\/$/)
  })

  test('adds a player, corrects a result, and sees standings recalculate with an audit trail', async ({
    page,
  }) => {
    await page.goto('./#/commissioner/players')
    await page.getByLabel('Name', { exact: true }).fill('Jordan Lee')
    await page.getByRole('button', { name: /add player/i }).click()
    await expect(page.getByRole('status')).toContainText(/jordan lee added with 3 lives/i)

    // Correct a week 1 result: Sofia lost on GB in week 1; flip that game.
    await page.goto('./#/commissioner/results')
    await page.getByLabel('Week').selectOption('1')
    const row = page.getByRole('listitem').filter({ hasText: /GB/ }).first()
    await row.getByRole('button', { name: /correct/i }).click()
    const dialog = page.getByRole('dialog')
    // Enter a score that makes GB the winner (the engine rejects contradictory winner/score).
    const scores = dialog.getByLabel(/score$/)
    await expect(scores).toHaveCount(2)
    for (const input of await scores.all()) await input.fill('30')
    await dialog.getByLabel(/^GB score/).fill('31')
    await dialog.getByLabel('Winner').selectOption('GB')
    await dialog.getByLabel(/reason/i).fill('stat correction')
    await dialog.getByRole('button', { name: /record result/i }).click()
    await expect(dialog.getByRole('status')).toContainText(/standings recalculated/i)
    await page.keyboard.press('Escape')

    await page.goto('./#/commissioner/audit')
    await expect(page.getByText(/overridden: stat correction/i)).toBeVisible()
    await expect(page.getByText(/jordan lee joined the league/i)).toBeVisible()
  })

  test('imports spreadsheet picks with a report that flags problems before anything is committed', async ({
    page,
  }) => {
    await page.goto('./#/commissioner/import')
    await page
      .getByLabel('CSV', { exact: true })
      .fill(
        'Player,Week 1,Week 2,Week 3\nMarcus Bell,Chiefs,Los Angeles,Ravens\nNobody Known,GB,KC,DAL\n',
      )
    await page.getByRole('button', { name: /^analyze$/i }).click()
    await expect(page.getByText(/AMBIGUOUS_TEAM/)).toBeVisible()
    await expect(page.getByText(/no league member matches "nobody known"/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /import \d+ picks/i })).toBeDisabled()

    await page
      .getByLabel('CSV', { exact: true })
      .fill('Player,Week 1,Week 2,Week 3\nMarcus Bell,Chiefs,Eagles,Ravens\n')
    await page.getByRole('button', { name: /^analyze$/i }).click()
    await expect(page.getByText(/clean import/i)).toBeVisible()
    await page.getByRole('button', { name: /import 3 picks/i }).click()
    await expect(page.getByRole('status')).toContainText(/3 picks imported/i)
  })

  test('sets a pick for a player after kickoff (commissioner override) and the demo clock moves time', async ({
    page,
  }) => {
    await page.goto('./#/commissioner/picks')
    const row = page.getByRole('listitem').filter({ hasText: 'Kwame Mensah' })
    await row.getByRole('button', { name: /set/i }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Team').selectOption('DET')
    await dialog.getByLabel('Reason').fill('texted pick before kickoff')
    await dialog.getByRole('button', { name: /save pick/i }).click()
    await expect(dialog.getByRole('status')).toContainText(/set to detroit lions/i)
    await page.keyboard.press('Escape')

    // Demo clock: a week later every week-4 game has kicked off (no results yet), so picks lock.
    await page.goto('./#/commissioner/settings')
    await page.getByRole('button', { name: /\+1 week/i }).click()
    await page.goto('./')
    await expect(page.getByText(/every game this week has kicked off/i)).toBeVisible()
    await page.getByRole('button', { name: /sign out/i }).click()
    await signInAs(page, 'Emily Chen')
    await page.goto('./#/pick')
    await expect(page.getByText(/kicked off .* locked/i)).toBeVisible()
  })
})
