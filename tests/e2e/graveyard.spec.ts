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
    // The funeral waits for an audience: off screen it has not started, and it
    // plays once the grave is scrolled into view.
    const grave = graves.locator('[data-funeral]')
    // Measured through locators, like league-message.spec, so the spec needs no DOM types.
    const box = await grave.boundingBox()
    const offScreen = !!box && box.y > (page.viewportSize()?.height ?? 0)
    if (offScreen) await expect(grave).toHaveAttribute('data-funeral', 'waiting')
    await grave.scrollIntoViewIfNeeded()
    await expect(grave).toHaveAttribute('data-funeral', 'playing')

    // His face is no longer one of the headshots on the page.
    await expect(page.getByRole('img', { name: 'Headshot of Nate Adams' })).toHaveCount(0)

    await graves.getByRole('link', { name: /Nate Adams/ }).click()
    await expect(page).toHaveURL(/#\/players\/nate-adams$/)
    await expect(page.getByRole('img', { name: /^Headstone of Nate Adams/ })).toBeVisible()
    const epitaph = page.locator('section[aria-labelledby="epitaph-title"]')
    await expect(epitaph.getByRole('heading', { name: /^Epitaph/ })).toBeVisible()
    // Written from his record until the commissioner writes his own.
    await expect(epitaph).toContainText(/left it in week 3/)
    await expect(epitaph).toContainText(/Rest in peace, Nate/)
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

  test('a row of fresh graves keeps every "finally done in" tag inside its own card', async ({
    page,
  }) => {
    // The real weeks 1–4, plus Thursday of week 5: Tampa Bay 24, Dallas 16.
    // That buries the five last-life Dallas pickers alongside Don.
    const week5 = { '2026-w05-TB-at-DAL': [24, 16] as [number, number] }
    await resetDemo(page)
    await signInAs(page, COMMISSIONER)
    await setDemoClock(page, '2026-10-09T15:00')
    await page.route('**/site.api.espn.com/**', (route) => {
      const week = Number(new URL(route.request().url()).searchParams.get('week'))
      const events = season.games
        .filter((g) => g.week === week && week <= 5)
        .map((g) => {
          const final = week5[g.id as keyof typeof week5] ?? (week <= 4 ? FINALS[g.id] : undefined)
          const [away, home] = final ?? [0, 0]
          return {
            date: g.kickoffAt,
            competitions: [
              {
                date: g.kickoffAt,
                status: { type: { name: final ? 'STATUS_FINAL' : 'STATUS_SCHEDULED' } },
                competitors: [
                  {
                    homeAway: 'home',
                    score: String(home),
                    winner: !!final && home > away,
                    team: { abbreviation: g.homeTeamId },
                  },
                  {
                    homeAway: 'away',
                    score: String(away),
                    winner: !!final && away > home,
                    team: { abbreviation: g.awayTeamId },
                  },
                ],
              },
            ],
          }
        })
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ season: { year: 2026, type: 2 }, week: { number: week }, events }),
      })
    })
    await page.goto('./#/')
    const graves = page.locator('section[aria-labelledby="grave-title"]')
    await expect(graves.getByRole('img', { name: /^Headstone of/ })).toHaveCount(6, {
      timeout: 20_000,
    })

    // Freeze every scene on its last frame, so the tags sit where they land.
    await page.addStyleTag({
      content:
        '.funeral-weapon, .funeral-score { animation: none !important; transform: none !important; opacity: 1 !important; }',
    })
    const tags = graves.locator('.funeral-score')
    await expect(tags).toHaveCount(6)
    for (let i = 0; i < 6; i++) {
      const tag = tags.nth(i)
      const card = tag.locator('xpath=ancestor::a[contains(@class, "card")]')
      const [t, c] = await Promise.all([tag.boundingBox(), card.boundingBox()])
      expect(t && c, `tag ${i}`).toBeTruthy()
      expect(t!.x, `tag ${i} left edge`).toBeGreaterThanOrEqual(c!.x)
      expect(t!.x + t!.width, `tag ${i} right edge`).toBeLessThanOrEqual(c!.x + c!.width)
    }
  })
})
