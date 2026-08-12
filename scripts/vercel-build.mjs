import { spawnSync } from 'node:child_process'

/**
 * Production uses the production Convex deploy key.
 * Preview/staging share one Convex preview named "staging" so feature
 * branches (e.g. OpenSea) keep their own Vercel frontend but talk to
 * the same backend + data as the staging site.
 */
const isProduction = process.env.VERCEL_ENV === 'production'

const args = [
  'convex',
  'deploy',
  '--cmd',
  'pnpm build',
  '--cmd-url-env-var-name',
  'NUXT_PUBLIC_CONVEX_URL',
]

if (!isProduction) {
  args.push('--preview-name', 'staging')
}

const result = spawnSync('npx', args, {
  stdio: 'inherit',
  env: process.env,
})

process.exit(result.status ?? 1)
