import { expect, test, type Page } from '@playwright/test'
import { COMMISSIONER, resetDemo, serveEspn, setDemoClock, signInAs, SUNDAY_AFTERNOON } from './helpers'

/**
 * Live scores on the slate.
 *
 * The whole pipeline existed before this: ESPN client, parser, idempotent
 * merge. What was missing was a trigger anyone but the commissioner could
 * reach, and a tile that showed a game already under way. These tests pin both.
 *
 * ESPN is served from a stub, never the real feed — CI has no network, and a
 * test that depended on Sunday's actual scores could not assert anything.
 */

/** The real week 1 Jacksonville game, as ESPN would report it mid-third-quarter. */
const scoreboard = (jaxScore: string, detail: string) => ({
  season: { year: 2026, type: 2 },
  week: { number: 1 },
  events: [
    {
      date: '2026-09-13T17:00Z',
      competitions: [
        {
          date: '2026-09-13T17:00Z',
          status: {
            displayClock: '5:21',
            period: 3,
            type: { name: 'STATUS_IN_PROGRESS', shortDetail: detail },
          },
          competitors: [
            { homeAway: 'home', score: jaxScore, team: { abbreviation: 'JAX' } },
            { homeAway: 'away', score: '10', team: { abbreviation: 'CLE' } },
          ],
        },
      ],
    },
  ],
})

const jaxTile = (page: Page) =>
  page.locator('section[aria-labelledby="slate-title"]').getByRole('listitem').filter({
    hasText: /jaguars/i,
  })

/** Sunday afternoon of week 1: the 17:00Z games have kicked off. */
async function openMidGame(page: Page) {
  await resetDemo(page)
  await signInAs(page, COMMISSIONER)
  await setDemoClock(page, SUNDAY_AFTERNOON)
}

test.describe('live scores on the slate', () => {
  test('a game under way shows its score and where it is up to', async ({ page }) => {
    await openMidGame(page)
    await serveEspn(page, scoreboard('14', '3rd 5:21'))
    await page.goto('./#/')

    const tile = jaxTile(page)
    await expect(tile).toContainText('14')
    await expect(tile).toContainText('10')
    await expect(tile).toContainText('3rd 5:21')
    // The kickoff time is replaced once a game starts, not shown alongside it.
    await expect(tile).not.toContainText(/CLE at JAX/i)
  })

  // The pulse itself is asserted in GameRow.test.tsx, where a one-second
  // animation can be observed without racing it. This covers the round trip:
  // a new score at the feed reaches the tile on the next poll.
  test('a later poll brings the new score to the tile', async ({ page }) => {
    // Installed before the page loads, so the poll's own timer is controlled.
    await page.clock.install()
    await openMidGame(page)
    await serveEspn(page, scoreboard('14', '3rd 5:21'))
    await page.goto('./#/')
    const tile = jaxTile(page)
    await expect(tile).toContainText('14')

    await serveEspn(page, scoreboard('21', '4th 12:04'))
    await page.clock.runFor('01:00')

    await expect(tile).toContainText('21')
    await expect(tile).toContainText('4th 12:04')
  })

  test('a week nobody is playing does not call the feed at all', async ({ page }) => {
    await resetDemo(page)
    let calls = 0
    await page.route('**/site.api.espn.com/**', (route) => {
      calls += 1
      return route.abort()
    })
    // The pinned clock sits before every week 1 kickoff.
    await page.goto('./#/')
    await expect(page.getByRole('heading', { name: /still standing/i })).toBeVisible()
    await page.waitForTimeout(1500)
    expect(calls, 'nothing has kicked off, so there is nothing to fetch').toBe(0)
  })

  test('an unreachable feed leaves the slate readable', async ({ page }) => {
    await openMidGame(page)
    // resetDemo already aborts every ESPN call.
    await page.goto('./#/')

    const tile = jaxTile(page)
    await expect(tile).toBeVisible()
    // Falls back to what is stored: kickoff time, no invented score.
    await expect(tile).toContainText(/CLE at JAX/i)
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
})
