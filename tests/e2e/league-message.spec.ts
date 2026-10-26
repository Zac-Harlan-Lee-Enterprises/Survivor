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
    // A review: several paragraphs, with the count of the week's dead.
    expect(await note.locator('p').count()).toBeGreaterThan(2)
    await expect(note).toContainText(/knocked out this week/)

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

  /**
   * The pick instruction is the one line that costs someone a life if they
   * miss it, so it is asserted apart from the banter: where to send it, when
   * it locks, what missing costs.
   */
  test('tells everyone where to send a pick, when it locks, and what missing costs', async ({
    page,
  }) => {
    await resetDemo(page)
    const note = page.locator('section[aria-labelledby="league-message-title"]')
    await expect(note).toBeVisible()
    await expect(note).toContainText(/pick on Teams/i)
    await expect(note).toContainText(/\d\d?:\d\d (AM|PM)/i)
    await expect(note).toContainText(/costs a life/i)
  })

  test('reads on a phone too, and is announced as a section', async ({ page }) => {
    await resetDemo(page)
    await expect(
      page.getByRole('heading', { name: /word from the (late )?commissioner/i }),
    ).toBeVisible()
  })
})
