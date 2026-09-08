/**
 * Normalises the configured GitHub Pages base path.
 *
 * GitHub Pages serves a project site at https://<owner>.github.io/<repo>/ —
 * never at "/". Vite must therefore be told the base so that every asset URL
 * and the router's history resolve under the subpath. This helper is pure so
 * it can be unit-tested without Vite.
 *
 *   resolveBasePath(undefined)      -> "/"
 *   resolveBasePath("")             -> "/"
 *   resolveBasePath("Survivor")     -> "/Survivor/"
 *   resolveBasePath("/Survivor")    -> "/Survivor/"
 *   resolveBasePath("/Survivor/")   -> "/Survivor/"
 *   resolveBasePath("org.github.io")-> "/"   (user/org site root)
 */
export function resolveBasePath(raw: string | undefined | null): string {
  const value = (raw ?? '').trim()
  if (value === '' || value === '/' || value === './') return '/'
  // A user/org site repo (<owner>.github.io) is served at the root.
  if (/\.github\.io$/i.test(value.replace(/^\/|\/$/g, ''))) return '/'
  const trimmed = value.replace(/^\/+|\/+$/g, '')
  if (trimmed === '') return '/'
  return `/${trimmed}/`
}

/**
 * Derives the base path from a GitHub Actions `GITHUB_REPOSITORY` value
 * ("owner/repo") when VITE_BASE_PATH is not set explicitly.
 */
export function basePathFromRepository(repository: string | undefined | null): string {
  if (!repository) return '/'
  const name = repository.split('/').pop() ?? ''
  return resolveBasePath(name)
}
