import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import ports from '../../build/ports.json' with { type: 'json' }

/**
 * The Pages look-alike server must behave like GitHub Pages, otherwise the
 * e2e suite would prove nothing. Uses the last e2e build if present.
 */
const ROOT = join(import.meta.dirname, '..', '..')
const DIST = join(ROOT, 'dist-e2e')
const PORT = ports.pagesTest
const BASE = `http://localhost:${PORT}/Survivor/`
const hasBuild = existsSync(join(DIST, 'index.html'))

describe.skipIf(!hasBuild)('scripts/serve-static.mjs mimics GitHub Pages', () => {
  let proc: ChildProcess
  beforeAll(async () => {
    proc = spawn(
      process.execPath,
      [
        'scripts/serve-static.mjs',
        '--dir',
        'dist-e2e',
        '--base',
        '/Survivor/',
        '--port',
        String(PORT),
      ],
      { cwd: ROOT, stdio: 'ignore' },
    )
    for (let i = 0; i < 50; i++) {
      try {
        const r = await fetch(BASE)
        if (r.ok) return
      } catch {
        /* not up yet */
      }
      await new Promise((r) => setTimeout(r, 100))
    }
    throw new Error('serve-static did not start')
  })
  afterAll(() => proc?.kill())

  it('serves index.html at the base and assets beneath it', async () => {
    expect((await fetch(BASE)).status).toBe(200)
    expect((await fetch(`${BASE}headshots/default.svg`)).status).toBe(200)
  })
  it('redirects the bare repo path to the base with a trailing slash', async () => {
    const r = await fetch(`http://localhost:${PORT}/Survivor`, { redirect: 'manual' })
    expect(r.status).toBe(301)
    expect(r.headers.get('location')).toBe('/Survivor/')
  })
  it('returns a real 404 (with 404.html) for deep links and for paths outside the base', async () => {
    const deep = await fetch(`${BASE}leaderboard`)
    expect(deep.status).toBe(404)
    expect(await deep.text()).toContain("var base = '/Survivor/'")
    expect((await fetch(`http://localhost:${PORT}/`)).status).toBe(404)
  })
})
