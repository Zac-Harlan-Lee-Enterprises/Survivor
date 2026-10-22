import { expect, test } from '@playwright/test'
import { resetDemo } from './helpers'

/**
 * The commissioner's note sits between the scoreboard and the standings, so it
 * is read before anyone scrolls to see who is still alive.
 */
test.describe('word from the commissioner', () => {
  test('appears between the scoreboard and the standings', async ({ page }) => {
    await resetDemo(page)
    const note = page.locator('section[aria-labelledby="league-message-title"]')
    await expect(note).toBeVisible()
    // (The commissioner may be late — he was buried in week 6 — and still writes.)
    await expect(note).toContainText(/word from the (late )?commissioner/i)
    await expect(note.locator('p')).toHaveCount(1)
    await expect(note).toContainText('Being commissioner was easier when I was alive.')
    await expect(note).toContainText('The tall gentleman behind me has declined to comment.')

    // Order on the page: hero, then the note, then Still standing. Measured
    // through locators so the spec needs no DOM types.
    const topOf = async (id: string) => {
      const box = await page.locator(`#${id}`).boundingBox()
      if (!box) throw new Error(`#${id} is not on the page`)
      return box.y
    }
    const hero = await topOf('hero-title')
    const message = await topOf('league-message-title')
    const standing = await topOf('alive-title')
    expect(hero).toBeLessThan(message)
    expect(message).toBeLessThan(standing)
  })

  test('has no pick instruction that goes stale after Thursday', async ({ page }) => {
    await resetDemo(page)
    const note = page.locator('section[aria-labelledby="league-message-title"]')
    await expect(note).toBeVisible()
    await expect(note).not.toContainText(/pick on Teams|7:10|costs a life/i)
  })

  test('reads on a phone too, and is announced as a section', async ({ page }) => {
    await resetDemo(page)
    await expect(
      page.getByRole('heading', { name: /word from the (late )?commissioner/i }),
    ).toBeVisible()
  })
})
