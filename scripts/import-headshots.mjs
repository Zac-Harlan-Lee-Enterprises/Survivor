#!/usr/bin/env node
/**
 * import-headshots — turns a folder of real photos into the app's headshot
 * assets.
 *
 *   npm run headshots:import                 # reads ./photos
 *   npm run headshots:import -- --dir path   # or any folder
 *   npm run headshots:import -- --dry-run    # show the mapping, write nothing
 *
 * For each photo it honours EXIF orientation (phone photos are often rotated),
 * crops a square using sharp's attention strategy so faces are not sliced off,
 * and writes two WebP variants (128px thumb, 512px medium) into
 * public/headshots/, plus a manifest the fixture generator reads.
 *
 * Files are matched to players by name. Anything ambiguous or unmatched is
 * REPORTED, never guessed — the same rule the CSV import follows.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'
import sharp from 'sharp'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}
const SRC = resolve(process.cwd(), flag('dir', 'photos'))
const OUT = resolve(process.cwd(), 'public/headshots')
const FIXTURE = resolve(process.cwd(), 'src/data/demo/fixtures/demo-season.json')
const DRY = args.includes('--dry-run')
const VARIANTS = { thumb: 128, medium: 512 }
const ACCEPTED = new Set(['.jpg', '.jpeg', '.png', '.webp'])

if (!existsSync(SRC)) {
  console.error(`No photo folder at ${SRC}. Put one image per player there, named after them.`)
  process.exit(2)
}

// ---------------------------------------------------------------- matching --
const roster = JSON.parse(readFileSync(FIXTURE, 'utf8')).profiles.map((p) => ({
  playerId: p.playerId,
  displayName: p.displayName,
}))
const norm = (s) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp[a.length][b.length]
}

/** Exact, then prefix, then a near-miss of at most two characters. */
function matchPlayer(fileName) {
  const key = norm(basename(fileName, extname(fileName)))
  const scored = roster.map((p) => {
    const id = norm(p.playerId)
    const name = norm(p.displayName)
    if (key === id || key === name) return { p, rank: 0 }
    const long = (a, b) => a.length >= 6 && b.length >= 6 && (a.startsWith(b) || b.startsWith(a))
    if (long(key, id) || long(key, name)) return { p, rank: 1 }
    const d = Math.min(editDistance(key, id), editDistance(key, name))
    return { p, rank: d <= 2 ? 2 + d : Infinity }
  })
  const best = Math.min(...scored.map((s) => s.rank))
  if (!Number.isFinite(best)) return { kind: 'unmatched' }
  const winners = scored.filter((s) => s.rank === best)
  if (winners.length > 1) return { kind: 'ambiguous', candidates: winners.map((w) => w.p.playerId) }
  return { kind: 'match', player: winners[0].p, exact: best === 0 }
}

// ------------------------------------------------------------------ import --
const files = readdirSync(SRC)
  .filter((f) => ACCEPTED.has(extname(f).toLowerCase()) && !f.startsWith('.'))
  .sort()
if (files.length === 0) {
  console.error(`No images in ${SRC} (accepted: ${[...ACCEPTED].join(', ')})`)
  process.exit(2)
}

if (!DRY) mkdirSync(OUT, { recursive: true })
const manifest = {}
const problems = []
let written = 0

for (const file of files) {
  const src = join(SRC, file)
  const hit = matchPlayer(file)
  if (hit.kind !== 'match') {
    problems.push(
      hit.kind === 'ambiguous'
        ? `${file}: could be ${hit.candidates.join(' or ')} — rename it to one of those.`
        : `${file}: no league member matches this name — rename it, or add the player first.`,
    )
    continue
  }
  const { playerId, displayName } = hit.player
  if (manifest[playerId]) {
    problems.push(`${file}: ${displayName} already has a photo (${manifest[playerId].from}).`)
    continue
  }

  const meta = await sharp(src).metadata()
  const variants = {}
  let mediumBytes = 0
  let mediumEdge = 0
  for (const [variant, size] of Object.entries(VARIANTS)) {
    const rel = `headshots/${playerId}-${variant}.webp`
    // rotate() applies EXIF orientation; attention crop keeps the face in frame;
    // withoutEnlargement avoids faking detail a small original does not have.
    const buf = await sharp(src)
      .rotate()
      .resize(size, size, {
        fit: 'cover',
        position: sharp.strategy.attention,
        withoutEnlargement: true,
      })
      .webp({ quality: 88 })
      .toBuffer()
    if (!DRY) writeFileSync(join(OUT, `${playerId}-${variant}.webp`), buf)
    variants[variant] = rel
    if (variant === 'medium') {
      mediumBytes = buf.length
      mediumEdge = Math.min(size, meta.width ?? size, meta.height ?? size)
    }
  }
  manifest[playerId] = {
    from: file,
    contentType: 'image/webp',
    sizeBytes: mediumBytes,
    width: mediumEdge,
    height: mediumEdge,
    variants,
  }
  written += 1
  const small = mediumEdge < VARIANTS.medium ? `  (source only ${meta.width}x${meta.height})` : ''
  console.log(
    `  ${file.padEnd(26)} -> ${displayName.padEnd(20)} ${mediumEdge}px, ${(mediumBytes / 1024).toFixed(0)} KB${small}`,
  )
}

const missing = roster.filter((p) => !manifest[p.playerId])
if (!DRY) {
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
}

console.log(
  `\n${DRY ? '[dry run] ' : ''}${written} of ${roster.length} players have a photo (${files.length} files scanned).`,
)
if (missing.length) {
  console.log(
    `No photo for: ${missing.map((p) => p.displayName).join(', ')} — they show the default avatar.`,
  )
}
if (problems.length) {
  console.log('\nNeeds attention:')
  for (const p of problems) console.log(`  - ${p}`)
}
if (!DRY) console.log('\nNext: npm run fixtures:generate')
process.exit(problems.length ? 1 : 0)
