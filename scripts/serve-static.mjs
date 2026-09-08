#!/usr/bin/env node
/**
 * serve-static.mjs — a GitHub Pages look-alike for local verification.
 *
 *   node scripts/serve-static.mjs --dir dist-e2e --base /Survivor/ --port 4173
 *
 * Behaves like Pages, not like `vite preview`:
 *   - files are served ONLY under the base path (https://owner.github.io/<repo>/)
 *   - a directory resolves to its index.html
 *   - anything else is a real HTTP 404 whose body is <dir>/404.html (if present)
 *   - there is NO SPA fallback — if the app needs one it is broken on Pages
 */
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--'))
      acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true'])
    return acc
  }, []),
)
const dir = resolve(process.cwd(), args.dir ?? 'dist')
let base = args.base ?? '/'
if (!base.startsWith('/')) base = `/${base}`
if (!base.endsWith('/')) base = `${base}/`
const port = Number(args.port ?? 4173)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

function send(res, status, filePath) {
  res.writeHead(status, {
    'Content-Type': TYPES[extname(filePath)] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  })
  createReadStream(filePath).pipe(res)
}

function notFound(res) {
  const page = join(dir, '404.html')
  if (existsSync(page)) return send(res, 404, page)
  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('404 Not Found')
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`)
  let pathname = decodeURIComponent(url.pathname)
  // GitHub Pages redirects /<repo> → /<repo>/
  if (pathname + '/' === base) {
    res.writeHead(301, { Location: base + url.search })
    return res.end()
  }
  if (!pathname.startsWith(base)) return notFound(res)
  pathname = pathname.slice(base.length)
  const target = normalize(join(dir, pathname))
  if (!target.startsWith(dir + sep) && target !== dir) return notFound(res)
  if (existsSync(target)) {
    const st = statSync(target)
    if (st.isDirectory()) {
      const index = join(target, 'index.html')
      return existsSync(index) ? send(res, 200, index) : notFound(res)
    }
    return send(res, 200, target)
  }
  return notFound(res)
})

server.listen(port, () => {
  console.log(
    `[serve-static] ${dir} at http://localhost:${port}${base} (404.html fallback, no SPA rewrite)`,
  )
})
