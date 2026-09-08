#!/usr/bin/env node
// Generates the sample headshots used by demo mode: deterministic SVG
// avatars (initials on a team-colour gradient). Real leagues upload real
// photos in connected mode; these are placeholders so the demo has faces.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const OUT = resolve(process.cwd(), 'public/headshots')
mkdirSync(OUT, { recursive: true })

const PEOPLE = [
  ['marcus-bell', 'MB', '#E31837', '#FFB81C'],
  ['priya-raman', 'PR', '#00338D', '#C60C30'],
  ['danny-okafor', 'DO', '#041E42', '#869397'],
  ['sofia-reyes', 'SR', '#203731', '#FFB612'],
  ['tom-lindqvist', 'TL', '#125740', '#0b1020'],
  ['jada-whitfield', 'JW', '#004C54', '#A5ACAD'],
  ['luis-herrera', 'LH', '#AA0000', '#B3995D'],
  ['emily-chen', 'EC', '#241773', '#9E7C0C'],
  ['kwame-mensah', 'KM', '#FB4F14', '#0b1020'],
  ['hannah-obrien', 'HO', '#0076B6', '#B0B7BC'],
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
