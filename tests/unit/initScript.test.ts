import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Regression guards for init.sh. Each assertion here corresponds to a bug that
 * made `./init.sh` appear not to restart the app; the comments say which.
 */
const ROOT = join(import.meta.dirname, '..', '..')
const init = readFileSync(join(ROOT, 'init.sh'), 'utf8')
/** Executable lines only — comments explain these bugs and would match themselves. */
const code = init
  .split('\n')
  .filter((line) => !line.trim().startsWith('#'))
  .join('\n')

describe('init.sh restart correctness', () => {
  it('starts vite directly, not through npx', () => {
    // BUG: `nohup npx vite &` recorded the WRAPPER pid in .pids/dev.pid while
    // the real server ran as its child, so --stop killed the wrapper and
    // orphaned the listener still holding the port.
    expect(
      init,
      'start vite via node_modules/.bin/vite so $! is the real listening process',
    ).toMatch(/nohup node_modules\/\.bin\/vite/)
    expect(code, 'must not launch the dev server through npx').not.toMatch(/nohup npx vite/)
  })

  it('only treats LISTENING sockets as owning a port', () => {
    // BUG: plain `lsof -ti:PORT` also returns processes merely CONNECTED to the
    // port (an editor's port forwarding), which produced bogus "used by another
    // process" warnings and kill attempts against innocent processes.
    expect(code, 'port lookups must filter with -sTCP:LISTEN').toMatch(
      /lsof -ti:"\$1" -sTCP:LISTEN/,
    )
    expect(
      code.match(/lsof -ti:[^\n]*/g)?.filter((line) => !line.includes('-sTCP:LISTEN')) ?? [],
      'every lsof port lookup must be listener-only',
    ).toEqual([])
  })

  it('waits for the port to actually free instead of sleeping blindly', () => {
    // BUG: a fixed `sleep 0.5` raced with vite's --strictPort, which refuses to
    // start while the previous server still holds the socket.
    expect(init).toMatch(/wait_for_port_free/)
    expect(init, 'escalate to SIGKILL when SIGTERM is ignored').toMatch(/kill -9/)
  })

  it('corrects the pid file to the process that is really listening', () => {
    expect(init).toMatch(/verify_pidfile/)
  })

  it('clears the preview port on every run, not only with --with-pages', () => {
    // BUG: a leftover serve-static kept serving a PREVIOUS build, which reads
    // as "my changes did nothing".
    const mainSection = init.slice(init.indexOf('# 1. Kill stale processes'))
    expect(mainSection).toMatch(/kill_port "\$PAGES_PORT"/)
  })

  it('--stop cannot abort part-way when a foreign process holds a port', () => {
    const stop = init.slice(init.indexOf('--stop'), init.indexOf('# 0. Pre-flight'))
    expect(stop).toMatch(/kill_port "\$DEV_PORT" \|\| true/)
    expect(stop).toMatch(/kill_port "\$PAGES_PORT" \|\| true/)
  })
})
