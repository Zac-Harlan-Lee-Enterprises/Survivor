#!/usr/bin/env node
// Bundles each Lambda handler into backend/dist/<name>/index.mjs with esbuild.
// The AWS SDK v3 is provided by the Node 22 Lambda runtime, so it is external.
import { build } from 'esbuild'
import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.cwd(), 'backend')
const handlers = ['api', 'syncResults']

rmSync(resolve(root, 'dist'), { recursive: true, force: true })
mkdirSync(resolve(root, 'dist'), { recursive: true })

for (const name of handlers) {
  await build({
    entryPoints: [resolve(root, 'src', 'handlers', `${name}.ts`)],
    outfile: resolve(root, 'dist', name, 'index.mjs'),
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    sourcemap: true,
    minify: false,
    external: ['@aws-sdk/*'],
    banner: {
      js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
    },
    alias: {
      '@domain': resolve(process.cwd(), 'src', 'domain'),
      '@': resolve(process.cwd(), 'src'),
    },
    logLevel: 'warning',
  })
  console.log(`built backend/dist/${name}/index.mjs`)
}
