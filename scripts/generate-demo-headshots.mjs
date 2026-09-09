#!/usr/bin/env node
// Generates placeholder headshots for the league roster: deterministic SVG
// avatars (initials on a team-colour gradient). They exist so every player has
// a face before real photos are uploaded (Commissioner → Players, or connected
// mode). Slugs must match the player ids in generate-demo-fixtures.ts.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const OUT = resolve(process.cwd(), 'public/headshots')
mkdirSync(OUT, { recursive: true })

const PEOPLE = [
  // [slug, initials, colour A, colour B] — distinct pairs so faces stay
  // tellable apart at thumbnail size. Placeholders only: the commissioner
  // replaces these with real photos in Commissioner → Players.
  ['maya-israel', 'MI', '#006778', '#D7A22A'],
  ['shahid-ali', 'SA', '#241773', '#9E7C0C'],
  ['dave-johnson', 'DJ', '#0076B6', '#B0B7BC'],
  ['james-parker', 'JP', '#004C54', '#A5ACAD'],
  ['nate-adams', 'NA', '#0080C6', '#FFC20E'],
  ['stacey-markendorff', 'SM', '#AA0000', '#B3995D'],
  ['sheila-acker', 'SA', '#002244', '#69BE28'],
  ['dominic-green', 'DG', '#203731', '#FFB612'],
  ['zac-harlan', 'ZH', '#E31837', '#FFB81C'],
]

function svg(initials, a, b, opts = {}) {
  const label = opts.label ?? `Sample headshot placeholder for ${initials}`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${a}"/>
      <stop offset="1" stop-color="${b}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.25" r="0.7">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="256" height="256" fill="url(#g)"/>
  <rect width="256" height="256" fill="url(#glow)"/>
  <circle cx="128" cy="98" r="46" fill="#ffffff" fill-opacity="0.92"/>
  <path d="M40 232c8-52 46-78 88-78s80 26 88 78z" fill="#ffffff" fill-opacity="0.92"/>
  <text x="128" y="112" text-anchor="middle" font-family="'Barlow Condensed', 'Arial Narrow', Arial, sans-serif" font-weight="800" font-size="44" fill="${a}">${initials}</text>
</svg>
`
}

for (const [slug, initials, a, b] of PEOPLE) {
  writeFileSync(resolve(OUT, `${slug}.svg`), svg(initials, a, b))
}
writeFileSync(
  resolve(OUT, 'default.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="Default avatar">
  <rect width="256" height="256" fill="#1c2440"/>
  <circle cx="128" cy="98" r="46" fill="#8b94b3"/>
  <path d="M40 232c8-52 46-78 88-78s80 26 88 78z" fill="#8b94b3"/>
</svg>
`,
)
console.log(`wrote ${PEOPLE.length + 1} headshots to public/headshots/`)
