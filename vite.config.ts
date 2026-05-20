import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Resolve the base path automatically:
//   - `VITE_BASE` (explicit override) wins.
//   - When running in GitHub Actions, derive `/<repo-name>/` from
//     the `GITHUB_REPOSITORY` env var ("owner/repo").
//   - Otherwise default to "/" for local dev / custom-domain hosting.
function resolveBase(): string {
  if (process.env.VITE_BASE) return process.env.VITE_BASE
  const ghRepo = process.env.GITHUB_REPOSITORY
  if (process.env.GITHUB_ACTIONS && ghRepo) {
    const name = ghRepo.split('/')[1]
    if (name && !name.endsWith('.github.io')) return `/${name}/`
  }
  return '/'
}

// https://vite.dev/config/
export default defineConfig({
  base: resolveBase(),
  plugins: [react(), tailwindcss()],
})
