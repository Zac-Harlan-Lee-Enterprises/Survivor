#!/usr/bin/env node
// Generates the DEFAULT avatar only.
//
// Real players get real photos via `npm run headshots:import`, which reads the
// commissioner's photo folder. A player with no photo falls back to this
// neutral silhouette — deliberately anonymous, because a generated stand-in
// should never be mistaken for someone's actual face.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const OUT = resolve(process.cwd(), 'public/headshots')
mkdirSync(OUT, { recursive: true })

writeFileSync(
  resolve(OUT, 'default.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="Default avatar">
  <rect width="256" height="256" fill="#1c2440"/>
  <circle cx="128" cy="98" r="46" fill="#8b94b3"/>
  <path d="M40 232c8-52 46-78 88-78s80 26 88 78z" fill="#8b94b3"/>
</svg>
`,
)
console.log('wrote public/headshots/default.svg')
