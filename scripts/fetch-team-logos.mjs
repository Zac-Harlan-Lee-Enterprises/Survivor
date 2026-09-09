#!/usr/bin/env node
/**
 * fetch-team-logos — downloads the 32 NFL team logos and prepares web assets.
 *
 *   npm run logos:fetch
 *
 * Originals land in photos/team-logos/ (kept out of git, like the player
 * photos); trimmed 160px PNGs are written to public/team-logos/ and are what
 * the app ships. Every team id maps straight to ESPN's abbreviation.
 *
 * These are third-party marks served from ESPN's CDN. They are used here for a
 * private league's own scoreboard; check your own position before publishing.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'

const SRC_DIR = resolve(process.cwd(), 'photos/team-logos')
const OUT_DIR = resolve(process.cwd(), 'public/team-logos')
const DISPLAY_PX = 160
const CDN = (abbr) => `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr}.png`

const teams = [
  ...readFileSync(resolve(process.cwd(), 'src/domain/teams.ts'), 'utf8').matchAll(
    /^\s*\['([A-Z]{2,3})',/gm,
  ),
].map((m) => m[1])
if (teams.length !== 32) {
  console.error(`Expected 32 teams, parsed ${teams.length} from src/domain/teams.ts`)
  process.exit(1)
}

mkdirSync(SRC_DIR, { recursive: true })
mkdirSync(OUT_DIR, { recursive: true })

let downloaded = 0
let reused = 0
const failed = []

for (const id of teams) {
  const abbr = id.toLowerCase()
  const original = resolve(SRC_DIR, `${abbr}.png`)
  try {
    if (!existsSync(original)) {
      const res = await fetch(CDN(abbr))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      writeFileSync(original, Buffer.from(await res.arrayBuffer()))
      downloaded += 1
    } else {
      reused += 1
    }
    // Trim the transparent margin so every crest fills its badge evenly, then
    // fit inside a square canvas at display size.
    const buf = await sharp(original)
      .trim()
      .resize(DISPLAY_PX, DISPLAY_PX, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9 })
      .toBuffer()
    writeFileSync(resolve(OUT_DIR, `${abbr}.png`), buf)
  } catch (err) {
    failed.push(`${id}: ${err instanceof Error ? err.message : String(err)}`)
  }
}

console.log(
  `${teams.length - failed.length}/32 logos ready in public/team-logos/ (${downloaded} downloaded, ${reused} from cache)`,
)
if (failed.length) {
  console.error('Failed:')
  for (const f of failed) console.error(`  - ${f}`)
  process.exit(1)
}
