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
 * A photo whose automatic crop lands badly can be nudged by hand — see
 * CROP_NUDGES below.
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
const GENERATOR = resolve(process.cwd(), 'scripts/generate-demo-fixtures.ts')
const DRY = args.includes('--dry-run')
const VARIANTS = { thumb: 128, medium: 512 }

/**
 * Per-player crop nudges, for the occasional photo the attention strategy
 * reads wrong. A wide landscape selfie is the usual culprit: a bright sky and
 * a busy horizon can outscore the face, leaving the person low in the frame
 * under a band of cloud.
 *
 * `y` positions the square down the source as a fraction of the leftover
 * height — 0 is flush to the top, 0.5 centred, 1 flush to the bottom. `x` does
 * the same across the width. A larger `y` moves the crop DOWN the photo, which
 * moves the subject UP in the finished headshot.
 *
 * Values are expressed against the image after EXIF rotation, so they mean
 * what they look like rather than however the camera happened to store it.
 * Anything not listed here uses the attention strategy, which is right nearly
 * always. Keep this list short: a better original beats a nudge.
 */
const CROP_NUDGES = {
  // Wide mountain selfie — the sky outscored his face.
  'kc-walker': { y: 0.85 },
  // Tall caricature: the head fills the frame, so any crop below the top
  // slices it. Take the square from the very top of the source.
  'tony-canody': { y: 0 },
}
const ACCEPTED = new Set(['.jpg', '.jpeg', '.png', '.webp'])

if (!existsSync(SRC)) {
  console.error(`No photo folder at ${SRC}. Put one image per player there, named after them.`)
  process.exit(2)
}

// ---------------------------------------------------------------- matching --
/**
 * The roster comes from the GENERATOR, not the built fixture.
 *
 * Reading the fixture created a chicken-and-egg trap: a player added to the
 * generator had no photo until the fixture was rebuilt, but the fixture could
 * not attach a photo that had not been imported yet, so adding someone
 * required generate → import → generate and reported their photo as unmatched
 * in between. The generator is the source of truth for who is in the league.
 */
function readRoster() {
  const src = readFileSync(GENERATOR, 'utf8')
  const block = src.slice(src.indexOf('const PEOPLE: Person[] = ['), src.indexOf('/** [team, outcome]'))
  const people = [...block.matchAll(/id:\s*'([^']+)',\s*name:\s*'([^']+)'/g)].map((m) => ({
    playerId: m[1],
    displayName: m[2],
  }))
  if (people.length === 0) {
    console.error(`Could not read the roster from ${GENERATOR}. Has the PEOPLE list changed shape?`)
    process.exit(1)
  }
  return people
}
const roster = readRoster()
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
  const nudge = CROP_NUDGES[playerId]
  // A nudged photo is rotated ONCE up front, so the offsets are measured
  // against the image as a person sees it rather than as the camera stored it.
  const oriented = nudge ? await sharp(src).rotate().toBuffer({ resolveWithObject: true }) : null
  let square = null
  if (oriented) {
    const edge = Math.min(oriented.info.width, oriented.info.height)
    square = {
      left: Math.round((oriented.info.width - edge) * (nudge.x ?? 0.5)),
      top: Math.round((oriented.info.height - edge) * (nudge.y ?? 0.5)),
      width: edge,
      height: edge,
    }
  }
  const variants = {}
  let mediumBytes = 0
  let mediumEdge = 0
  for (const [variant, size] of Object.entries(VARIANTS)) {
    const rel = `headshots/${playerId}-${variant}.webp`
    // rotate() applies EXIF orientation; attention crop keeps the face in frame;
    // withoutEnlargement avoids faking detail a small original does not have.
    const buf = await (oriented ? sharp(oriented.data).extract(square) : sharp(src).rotate())
      .resize(size, size, {
        fit: 'cover',
        ...(oriented ? {} : { position: sharp.strategy.attention }),
        withoutEnlargement: true,
      })
      .webp({ quality: 88 })
      .toBuffer()
    if (!DRY) writeFileSync(join(OUT, `${playerId}-${variant}.webp`), buf)
    variants[variant] = rel
    if (variant === 'medium') {
      mediumBytes = buf.length
      mediumEdge = square
        ? Math.min(size, square.width)
        : Math.min(size, meta.width ?? size, meta.height ?? size)
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
