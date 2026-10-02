import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { COMMISSIONER, resetDemo, setDemoClock, signInAs } from './helpers'
import { FINALS, season } from '../unit/seasonFacts'

/**
 * When someone loses their last life they become a headstone, and the stone
 * links to a profile with their epitaph.
 *
 * Nobody has actually gone out yet, so this replays the real weeks 1–3 from a
 * stubbed ESPN feed with ONE COUNTERFACTUAL: San Francisco lose to Arizona in
 * week 3 (in reality they won 36–30). That takes Nate Adams — the Chargers in
 * week 1, Tampa Bay in week 2, San Francisco in week 3 — to zero. It exists only
 * in this test's browser, never in the league.
 */
const COUNTERFACTUAL: Record<string, [number, number]> = { '2026-w03-ARI-at-SF': [30, 27] }

/** One week of finals, shaped the way ESPN's scoreboard sends them. */
function scoreboard(week: number) {
  const events = season.games
    .filter((g) => g.week === week)
    .map((g) => {
      const [away, home] = COUNTERFACTUAL[g.id] ?? FINALS[g.id] ?? [0, 0]
      return {
        date: g.kickoffAt,
        competitions: [
          {
            date: g.kickoffAt,
            status: { type: { name: 'STATUS_FINAL', shortDetail: 'Final' } },
            competitors: [
              {
                homeAway: 'home',
                score: String(home),
                winner: home > away,
                team: { abbreviation: g.homeTeamId },
              },
              {
                homeAway: 'away',
                score: String(away),
                winner: away > home,
                team: { abbreviation: g.awayTeamId },
              },
            ],
          },
        ],
      }
    })
  return {
    season: { year: 2026, type: 2 },
    week: { number: week },
    events: week <= 3 ? events : [],
  }
}

/** Replays weeks 1–3, counterfactual included, and opens the league page. */
async function buryNate(page: Page) {
  await resetDemo(page)
  await signInAs(page, COMMISSIONER)
  // Tuesday after week 3: every game of weeks 1–3 has been played.
  await setDemoClock(page, '2026-09-29T15:00')
  await page.route('**/site.api.espn.com/**', (route) => {
    const week = Number(new URL(route.request().url()).searchParams.get('week'))
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(scoreboard(week)),
    })
  })
  await page.goto('./#/')
}

test.describe('the graveyard', () => {
  test('a player who loses their last life becomes a headstone that leads to their epitaph', async ({
    page,
  }) => {
    await buryNate(page)

    // Each settled week lets the next one sync, so this waits for week 3 to land.
    const graves = page.locator('section[aria-labelledby="grave-title"]')
    await expect(graves.getByRole('heading', { name: /fresh graves/i })).toBeVisible({
      timeout: 15_000,
    })
    const stone = graves.getByRole('img', {
      name: /^Headstone of Nate Adams, eliminated in week 3/,
    })
    await expect(stone).toBeVisible()
    await expect(stone).toHaveAccessibleName(
      /Died of the 49ers, week 3\. Complications: the Chargers \(wk 1\), the Buccaneers \(wk 2\)\./,
    )
    // His face is no longer one of the headshots on the page.
    await expect(page.getByRole('img', { name: 'Headshot of Nate Adams' })).toHaveCount(0)

    await graves.getByRole('link', { name: /Nate Adams/ }).click()
    await expect(page).toHaveURL(/#\/players\/nate-adams$/)
    await expect(page.getByRole('img', { name: /^Headstone of Nate Adams/ })).toBeVisible()
    const epitaph = page.locator('section[aria-labelledby="epitaph-title"]')
    await expect(epitaph.getByRole('heading', { name: 'Epitaph' })).toBeVisible()
    await expect(epitaph).toContainText(/still choosing his words/i)
  })

  test('the living keep their faces and have no epitaph', async ({ page }) => {
    await resetDemo(page)
    await page.goto('./#/players/maya-israel')
    await expect(page.getByRole('img', { name: 'Headshot of Maya Israel' })).toBeVisible()
    await expect(page.getByRole('img', { name: /Headstone/ })).toHaveCount(0)
    await expect(page.locator('section[aria-labelledby="epitaph-title"]')).toHaveCount(0)
  })

  test('a headstone profile has no WCAG A/AA violations, mid-funeral or after', async ({
    page,
  }) => {
    await buryNate(page)
    const graves = page.locator('section[aria-labelledby="grave-title"]')
    await expect(graves.getByRole('img', { name: /^Headstone of Nate Adams/ })).toBeVisible({
      timeout: 15_000,
    })
    for (const path of ['./#/', './#/players/nate-adams', './#/leaderboard']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(
        page.getByRole('img', { name: /^Headstone of Nate Adams/ }).first(),
      ).toBeVisible()
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
      const summary = results.violations.map(
        (v) =>
          `${v.id} (${v.impact}): ${v.help} → ${v.nodes
            .map((n) => n.target.join(' '))
            .slice(0, 3)
            .join(' | ')}`,
      )
      expect(summary, `${path}\n${summary.join('\n')}`).toEqual([])
    }
  })
})
