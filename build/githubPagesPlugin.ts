import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

/**
 * Emits a 404.html whose redirect logic knows the exact base path the bundle
 * was built for, plus a .nojekyll marker so GitHub Pages serves every asset
 * (Jekyll would otherwise ignore files/folders starting with an underscore).
 */
export function githubPagesPlugin(): Plugin {
  let base = '/'
  return {
    name: 'survivor:github-pages',
    apply: 'build',
    configResolved(config) {
      base = config.base
    },
    generateBundle() {
      const template = readFileSync(
        fileURLToPath(new URL('./404.template.html', import.meta.url)),
        'utf8',
      )
      this.emitFile({
        type: 'asset',
        fileName: '404.html',
        source: template.replaceAll('__BASE__', base),
      })
      this.emitFile({ type: 'asset', fileName: '.nojekyll', source: '' })
    },
  }
}
