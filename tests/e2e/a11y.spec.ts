import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { COMMISSIONER, resetDemo, signInAs } from './helpers'

/** WCAG 2.x A/AA automated checks (axe-core) on the primary screens. */

const ROUTES = [
  { name: 'league home', path: './', signIn: null },
  { name: 'leaderboard', path: './#/leaderboard', signIn: null },
  { name: 'season grid', path: './#/grid', signIn: null },
  { name: 'player profile', path: './#/players/marcus-bell', signIn: null },
  { name: 'sign in', path: './#/sign-in', signIn: null },
  { name: 'player dashboard', path: './#/me', signIn: 'Emily Chen' },
  { name: 'pick page', path: './#/pick', signIn: 'Emily Chen' },
  { name: 'my season', path: './#/my-season', signIn: 'Emily Chen' },
  { name: 'commissioner players', path: './#/commissioner/players', signIn: COMMISSIONER },
  { name: 'commissioner results', path: './#/commissioner/results', signIn: COMMISSIONER },
]

for (const route of ROUTES) {
  test(`${route.name} has no WCAG A/AA violations`, async ({ page }) => {
    await resetDemo(page)
    if (route.signIn) await signInAs(page, route.signIn)
    await page.goto(route.path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
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
    expect(summary, summary.join('\n')).toEqual([])
  })
}
