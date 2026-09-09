import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Executable architecture rules. Each failure message says WHAT broke, WHY
 * the rule exists and HOW to fix it — agents respond to failing tests, not to
 * prose in a doc. See AGENTS.md → Layer rules.
 */

const ROOT = join(import.meta.dirname, '..', '..')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === 'fixtures') continue
      walk(full, out)
    } else if (/\.(ts|tsx|mts)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

function rel(file: string): string {
  return relative(ROOT, file).split(sep).join('/')
}

function importsOf(file: string): string[] {
  const src = readFileSync(file, 'utf8')
  const specs: string[] = []
  const re =
    /(?:^|\n)\s*(?:import|export)\s[^'"\n]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) specs.push(m[1] ?? m[2] ?? m[3] ?? '')
  return specs.filter(Boolean)
}

const SRC = walk(join(ROOT, 'src'))
const BACKEND = walk(join(ROOT, 'backend', 'src'))

function fail(file: string, spec: string, why: string, fix: string): string {
  return `\nFAIL  ${rel(file)} imports "${spec}"\n      Why: ${why}\n      Fix: ${fix}\n`
}

describe('domain layer is pure', () => {
  const domainFiles = SRC.filter((f) => rel(f).startsWith('src/domain/'))

  it('exists and is non-trivial', () => {
    expect(domainFiles.length).toBeGreaterThan(5)
  })

  it('never imports React, the DOM, the data layer, or UI code', () => {
    const problems: string[] = []
    for (const file of domainFiles) {
      for (const spec of importsOf(file)) {
        const bad =
          /^react(-dom)?(\/|$)/.test(spec) ||
          /^@\/(data|app|components|features|lib|config)(\/|$)/.test(spec) ||
          /^@tanstack\//.test(spec) ||
          /^(\.\.\/)+(data|app|components|features|lib|config)(\/|$)/.test(spec) ||
          /^@aws-sdk\//.test(spec)
        if (bad) {
          problems.push(
            fail(
              file,
              spec,
              'src/domain is the deterministic rules engine shared by the browser AND the Lambda backend; it must stay framework-free and side-effect-free.',
              'Move UI/data concerns out of domain, or pass the value in as a function argument. Domain may import only zod and other domain modules.',
            ),
          )
        }
      }
    }
    expect(problems, problems.join('')).toEqual([])
  })

  it('never reads the clock or environment implicitly', () => {
    const problems: string[] = []
    for (const file of domainFiles) {
      if (/\.test\.ts$/.test(file) || rel(file).includes('/testing/')) continue
      const src = readFileSync(file, 'utf8')
      if (
        /\bDate\.now\(\)|new Date\(\)(?!\.)|import\.meta\.env|process\.env|localStorage|window\./.test(
          src.replace(/\/\/.*$/gm, ''),
        )
      ) {
        problems.push(
          `\nFAIL  ${rel(file)} reads ambient state (Date.now / new Date() / env / storage)\n      Why: rules must be a pure function of (snapshot, now) so results are reproducible and testable.\n      Fix: accept "now" or the config value as a parameter (see evaluateSeason(snapshot, { now })).\n`,
        )
      }
    }
    expect(problems, problems.join('')).toEqual([])
  })
})

describe('network access is confined to declared network modules', () => {
  /**
   * Exactly two modules may talk to the network, each owning one upstream:
   *   - src/data/api/http.ts       our AWS API (auth headers, DataError mapping)
   *   - src/data/nfl/espnClient.ts the public ESPN scoreboard (no auth, CORS-open)
   * Keeping them explicit means every network failure maps to one error type
   * and every caller can be stubbed in tests.
   */
  const NETWORK_MODULES = ['src/data/api/http.ts', 'src/data/nfl/espnClient.ts']

  it('fetch()/XMLHttpRequest/axios appear only in the declared network modules', () => {
    const problems: string[] = []
    for (const file of SRC) {
      const r = rel(file)
      if (NETWORK_MODULES.includes(r) || /\.test\.tsx?$/.test(r)) continue
      const src = readFileSync(file, 'utf8')
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
      if (/\bfetch\s*\(|XMLHttpRequest|from ['"]axios['"]/.test(src)) {
        problems.push(
          `\nFAIL  ${r} performs a network call directly\n      Why: network calls live in declared modules (${NETWORK_MODULES.join(', ')}) so errors map to one type and callers stay mockable.\n      Fix: add a typed method to src/data/api/repositories.ts (our API) or src/data/nfl/espnClient.ts (ESPN), and call that.\n`,
        )
      }
    }
    expect(problems, problems.join('')).toEqual([])
  })
})

describe('UI depends on ports, not adapters', () => {
  it('features/components/app never import demo or api implementations directly', () => {
    const problems: string[] = []
    for (const file of SRC) {
      const r = rel(file)
      if (!/^src\/(features|components|app)\//.test(r)) continue
      for (const spec of importsOf(file)) {
        if (/^@\/data\/(demo|api)(\/|$)/.test(spec) || /\/data\/(demo|api)(\/|$)/.test(spec)) {
          problems.push(
            fail(
              file,
              spec,
              'The UI must work identically in demo and connected mode; importing an adapter couples a screen to one backend.',
              'Use the Services interfaces via useServices() (src/app/hooks.ts). Mode selection lives only in src/data/index.ts and src/main.tsx.',
            ),
          )
        }
      }
    }
    expect(problems, problems.join('')).toEqual([])
  })

  it('only src/main.tsx and src/data/index.ts choose the data mode', () => {
    const problems: string[] = []
    for (const file of SRC) {
      const r = rel(file)
      if (r === 'src/main.tsx' || r === 'src/data/index.ts' || /\.test\.tsx?$/.test(r)) continue
      const src = readFileSync(file, 'utf8')
      if (
        /createServices\(|createDemoServices\(|createConnectedServices\(/.test(src) &&
        !r.startsWith('src/data/')
      ) {
        problems.push(
          `\nFAIL  ${r} constructs services\n      Why: services are constructed once at boot so every screen shares one clock, one auth session and one cache.\n      Fix: consume them through useServices() instead.\n`,
        )
      }
    }
    expect(problems, problems.join('')).toEqual([])
  })
})

describe('secrets never reach the browser bundle', () => {
  it('no AWS SDK or server-only package is imported from src/', () => {
    const problems: string[] = []
    for (const file of SRC) {
      for (const spec of importsOf(file)) {
        if (/^(@aws-sdk\/|aws-lambda|@types\/aws-lambda|node:)/.test(spec)) {
          problems.push(
            fail(
              file,
              spec,
              'The GitHub Pages bundle is public; AWS SDK usage (and credentials) belong in backend/ only.',
              'Call the API through src/data/api/repositories.ts, or move the code to backend/src.',
            ),
          )
        }
      }
    }
    expect(problems, problems.join('')).toEqual([])
  })

  it('only VITE_-prefixed, non-secret variables are read from import.meta.env, and only in src/config/env.ts', () => {
    const problems: string[] = []
    for (const file of SRC) {
      const r = rel(file)
      const src = readFileSync(file, 'utf8')
      if (/import\.meta\.env/.test(src) && r !== 'src/config/env.ts') {
        problems.push(
          `\nFAIL  ${r} reads import.meta.env directly\n      Why: configuration is validated once (zod) in src/config/env.ts so a bad deploy fails loudly at boot instead of silently mid-game.\n      Fix: add the value to AppConfig in src/config/env.ts and read getConfig().\n`,
        )
      }
      for (const m of src.matchAll(/VITE_[A-Z0-9_]+/g)) {
        if (/SECRET|PRIVATE|PASSWORD|TOKEN|ACCESS_KEY/.test(m[0])) {
          problems.push(
            `\nFAIL  ${r} references ${m[0]}\n      Why: every VITE_* variable is inlined into the public bundle — a secret here is a leak.\n      Fix: keep the secret in the AWS backend (SSM/Secrets Manager) and expose a non-secret identifier instead.\n`,
          )
        }
      }
    }
    expect(problems, problems.join('')).toEqual([])
  })
})

describe('backend shares the domain and validates with the same schemas', () => {
  it('backend handlers import the rules engine rather than re-implementing it', () => {
    const handlers = BACKEND.filter(
      (f) => rel(f).startsWith('backend/src/handlers/') && !/\.test\.ts$/.test(f),
    )
    expect(handlers.length, 'expected backend handlers under backend/src/handlers').toBeGreaterThan(
      0,
    )
    const problems: string[] = []
    for (const file of BACKEND) {
      const src = readFileSync(file, 'utf8')
      if (
        /strikes\s*\+=|livesRemaining\s*=|eliminated\s*=\s*true/.test(src) &&
        !rel(file).includes('domain')
      ) {
        problems.push(
          `\nFAIL  ${rel(file)} recomputes survivor state by hand\n      Why: strikes/lives/elimination are derived by src/domain/rules/engine.ts; a second implementation drifts.\n      Fix: call evaluateSeason()/validatePick() from @domain.\n`,
        )
      }
    }
    expect(problems, problems.join('')).toEqual([])
  })

  it('backend never imports React or browser-only modules', () => {
    const problems: string[] = []
    for (const file of BACKEND) {
      for (const spec of importsOf(file)) {
        if (/^react|^@\/(app|components|features)|^@\/data\/(demo|api)/.test(spec)) {
          problems.push(
            fail(
              file,
              spec,
              'Lambda code has no DOM and must stay small.',
              'Import from @domain only.',
            ),
          )
        }
      }
    }
    expect(problems, problems.join('')).toEqual([])
  })
})
