import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { basePathFromRepository, resolveBasePath } from './build/basePath.ts'
import { githubPagesPlugin } from './build/githubPagesPlugin.ts'
import ports from './build/ports.json' with { type: 'json' }

// GitHub Pages hosts project sites under /<repo>/ — the base is configurable
// via VITE_BASE_PATH (or derived from GITHUB_REPOSITORY in CI) and must never
// be assumed to be "/". Vite's --base CLI flag still overrides this.
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const base = env.VITE_BASE_PATH
    ? resolveBasePath(env.VITE_BASE_PATH)
    : basePathFromRepository(env.GITHUB_REPOSITORY)
  // Public, non-secret: it only builds "view the source" links. CI always sets
  // GITHUB_REPOSITORY, so the published site gets this without configuration.
  const repoUrl =
    env.VITE_REPO_URL ?? (env.GITHUB_REPOSITORY ? `https://github.com/${env.GITHUB_REPOSITORY}` : '')

  return {
    base,
    define: { 'import.meta.env.VITE_REPO_URL': JSON.stringify(repoUrl) },
    plugins: [react(), tailwindcss(), githubPagesPlugin()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      target: 'es2022',
      sourcemap: false,
    },
    // Distinctive ports (build/ports.json) so several editors/apps can run side by side.
    server: { port: ports.dev, strictPort: true },
    preview: { port: ports.pages, strictPort: true },
  }
})
