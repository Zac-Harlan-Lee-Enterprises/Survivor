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
    // That buries the five last-life Dallas pickers beside Don, who went in week 4.
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
    // Only this week's dead get the scene: five funerals; Don, a week older, is a plain stone.
    await expect(graves.locator('[data-funeral]')).toHaveCount(5)
    await expect(
      graves
        .locator('a.card', { has: page.getByRole('img', { name: /^Headstone of Don Turner/ }) })
        .locator('[data-funeral]'),
    ).toHaveCount(0)
    await expect(tags).toHaveCount(5)
    for (let i = 0; i < 5; i++) {
      const tag = tags.nth(i)
      const card = tag.locator('xpath=ancestor::a[contains(@class, "card")]')
      const [t, c] = await Promise.all([tag.boundingBox(), card.boundingBox()])
      expect(t && c, `tag ${i}`).toBeTruthy()
      expect(t!.x, `tag ${i} left edge`).toBeGreaterThanOrEqual(c!.x)
      expect(t!.x + t!.width, `tag ${i} right edge`).toBeLessThanOrEqual(c!.x + c!.width)
    }
  })

  test('every one of the week’s dead gets a funeral, however many', async ({ page }) => {
    // The real weeks 1–5 with TWO COUNTERFACTUALS (test-only, never the league):
    // Houston lose at Tennessee (really won 26–3) and New England lose to Las
    // Vegas (really won 45–17). That sends Corey, Joanna and Tina — each on a
    // last life — down with the five Dallas pickers: eight graves in one week,
    // more than the league page used to have room for.
    const flipped: Record<string, [number, number]> = {
      '2026-w05-HOU-at-TEN': [3, 26],
      '2026-w05-LV-at-NE': [45, 17],
    }
    await resetDemo(page)
    await signInAs(page, COMMISSIONER)
    // Wednesday after week 5: every week 5 game is final, week 6 has not begun.
    await setDemoClock(page, '2026-10-14T15:00')
    await page.route('**/site.api.espn.com/**', (route) => {
      const week = Number(new URL(route.request().url()).searchParams.get('week'))
      const events = season.games
        .filter((g) => g.week === week && week <= 5)
        .map((g) => {
          const [away, home] = flipped[g.id] ?? FINALS[g.id] ?? [0, 0]
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
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ season: { year: 2026, type: 2 }, week: { number: week }, events }),
      })
    })
    await page.goto('./#/')

    const graves = page.locator('section[aria-labelledby="grave-title"]')
    const fresh = graves.getByRole('img', { name: /^Headstone of .*, eliminated in week 5/ })
    await expect(fresh).toHaveCount(8, { timeout: 30_000 })
    for (const name of [
      'Craig Mowers',
      'Jared Marks',
      'Joseph Tomczuk',
      'Nate Adams',
      'Phyllis Collins',
      'Corey Cowell',
      'Joanna Moss',
      'Tina Bush',
    ]) {
      await expect(
        graves.getByRole('img', { name: new RegExp(`^Headstone of ${name},`) }),
      ).toHaveCount(1)
    }
    // Every one of this week's graves gets a funeral; Don, from week 4, is a plain stone behind.
    await expect(graves.locator('[data-funeral]')).toHaveCount(8)
    await expect(
      graves.getByRole('img', { name: /^Headstone of Don Turner, eliminated in week 4/ }),
    ).toHaveCount(1)
  })

  test('when the scene ends the grave holds still: no flash, the logo stays', async ({ page }) => {
    test.slow()
    await buryNate(page)
    const graves = page.locator('section[aria-labelledby="grave-title"]')
    const grave = graves.locator('[data-funeral]')
    await grave.scrollIntoViewIfNeeded({ timeout: 15_000 })
    await expect(grave).toHaveAttribute('data-funeral', 'playing', { timeout: 15_000 })
    const card = grave.locator('xpath=ancestor::a[contains(@class, "card")]')
    // Late in the scene, safely before its 21s curtain. The shot fast-forwards
    // whatever is still moving, so this is the frame the scene ends on.
    await page.waitForTimeout(19_000)
    await expect(grave).toHaveAttribute('data-funeral', 'playing')
    // The crow is tested on its own; here it would only add shadow anti-aliasing.
    // Death arrives once the scenes are over: he has his own test, and is kept
    // out of these pictures.
    // (On a phone, if his layer ever widened the page the browser would re-lay
    // it and this card would jump: this is what caught that.)
    const shot = () =>
      card.screenshot({
        animations: 'disabled',
        style: '.funeral-crow, .death-scene { visibility: hidden !important; }',
      })
    const before = await shot()
    await expect(grave).toHaveAttribute('data-funeral', 'done', { timeout: 5_000 })
    await expect(card.locator('.funeral-weapon img, .funeral-weapon > span').first()).toBeVisible()
    await expect(card.locator('.funeral-score')).toBeVisible()
    const after = await shot()
    expect(after.equals(before), 'the grave changed when the scene ended').toBe(true)

    // The held frame keeps the card raised over the house lights, but never over
    // the sticky header: scroll the grave up under it and the header stays on top.
    const header = page.locator('header').first()
    const headerBox = (await header.boundingBox())!
    // The graveyard ends the page; give it room to scroll up under the header.
    await page.addStyleTag({ content: 'main { padding-bottom: 150vh !important; }' })
    // Card's top edge to the very top of the window: the header now sits on it.
    const cardTop = (await card.boundingBox())!.y
    // (String scripts: this spec is compiled without DOM types.)
    await page.evaluate(`window.scrollBy(0, ${cardTop - 2})`)
    await page.waitForTimeout(100)
    const cardBox = (await card.boundingBox())!
    expect(cardBox.y).toBeLessThan(headerBox.height / 4)
    const onTop = await page.evaluate(
      `!!document.elementFromPoint(${cardBox.x + cardBox.width / 2}, ${headerBox.height / 2})?.closest('header')`,
    )
    expect(onTop, 'a finished grave painted over the sticky header').toBe(true)
  })

  test('when the funerals are over, Death arrives: the world stops, the crows leave, the stones frost', async ({
    page,
  }) => {
    test.slow()
    // Thursday of week 5, real results: Tampa Bay 24, Dallas 16 buries the five
    // last-life Dallas pickers.
    await thursdayOfWeek5(page)
    const graves = page.locator('section[aria-labelledby="grave-title"]')
    const stones = graves.locator('[data-funeral]')
    await expect(stones).toHaveCount(5, { timeout: 20_000 })
    // A funeral waits for its grave to be seen: on a phone that means scrolling down the row.
    for (const stone of await stones.all()) {
      await stone.scrollIntoViewIfNeeded()
      await expect(stone).not.toHaveAttribute('data-funeral', 'waiting', { timeout: 10_000 })
    }
    const scene = page.locator('.death-scene')
    await expect(scene).toHaveAttribute('data-death', 'arriving', { timeout: 45_000 })
    // One Death, over the whole page; everything else holds still for him.
    await expect(page.locator('.death-figure')).toHaveCount(1)
    await expect(page.locator('html')).toHaveClass(/death-is-here/)
    // He is rendered: every sheet of his frames is served (the canvas draws from them).
    const sheets = ((await scene.locator('canvas.death-sprite').getAttribute('data-sheets')) ?? '')
      .split(' ')
      .filter(Boolean)
    expect(sheets.length).toBeGreaterThan(1)
    for (const src of sheets) {
      expect(src).toMatch(/^death\/death-\d+\.webp$/)
      expect((await page.request.get(new URL(src, page.url()).href)).ok(), src).toBe(true)
    }
    // Hurry him along: finish each beat as soon as it starts (the falling rain loops forever).
    await scene.evaluate((el) => {
      const hurry = () => {
        for (const a of el.ownerDocument.getAnimations()) {
          if (a.effect?.getTiming().iterations !== Infinity) a.finish()
        }
        if (el.isConnected) setTimeout(hurry, 16)
      }
      hurry()
    })
    // Then he is not there; the page moves again; every crow is gone, every stone frosted.
    await expect(scene).toHaveCount(0, { timeout: 30_000 })
    await expect(page.locator('html')).not.toHaveClass(/death-is-here/)
    for (const stone of await stones.all()) await expect(stone).toHaveAttribute('data-frost', '')
    for (const crow of await graves.locator('.funeral-crow').all()) {
      await expect(crow).toHaveCSS('opacity', '0')
    }
  })

  test('viewers who prefer reduced motion get no funeral, so no Death', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await thursdayOfWeek5(page)
    const graves = page.locator('section[aria-labelledby="grave-title"]')
    await expect(graves.getByRole('img', { name: /^Headstone of/ })).toHaveCount(6, {
      timeout: 20_000,
    })
    await expect(page.locator('.death-scene')).toHaveCount(0)
  })
})

/** Weeks 1–4 as they really finished, and Thursday night of week 5: Tampa Bay 24, Dallas 16. */
async function thursdayOfWeek5(page: Page) {
  const week5: Record<string, [number, number]> = { '2026-w05-TB-at-DAL': [24, 16] }
  await resetDemo(page)
  await signInAs(page, COMMISSIONER)
  await setDemoClock(page, '2026-10-09T15:00')
  await page.route('**/site.api.espn.com/**', (route) => {
    const week = Number(new URL(route.request().url()).searchParams.get('week'))
    const events = season.games
      .filter((g) => g.week === week && week <= 5)
      .map((g) => {
        const final = week5[g.id] ?? (week <= 4 ? FINALS[g.id] : undefined)
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
}
