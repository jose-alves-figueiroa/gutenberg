// node scripts/builder.mjs <electron-builder args>
// Runs electron-builder with the config picked by GUTENBERG_MAC_SIGNING (PLAN.md → E14):
// - `adhoc` (default): electron-builder.yml, ad-hoc signature; on macOS the app downloads the .dmg
//   of a new version itself (E13);
// - `developer-id`: electron-builder.developer-id.yml, signed and notarized with the Apple
//   Developer ID; on macOS the app updates on its own, like Windows. Fails early without the
//   certificate and notarization variables.
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const MAC_SIGNINGS = ['adhoc', 'developer-id']
export const DEVELOPER_ID_ENV = ['CSC_LINK', 'CSC_KEY_PASSWORD', 'APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID']

/** electron-builder arguments for `args` under `env`; throws on a bad flag or missing secrets. */
export function builderArgs(args, env) {
  const signing = env.GUTENBERG_MAC_SIGNING || 'adhoc'
  if (!MAC_SIGNINGS.includes(signing)) throw new Error(`GUTENBERG_MAC_SIGNING must be ${MAC_SIGNINGS.join(' or ')}, not "${signing}"`)
  if (signing === 'adhoc' || !args.includes('--mac')) return args
  const missing = DEVELOPER_ID_ENV.filter((name) => !env[name])
  if (missing.length) throw new Error(`GUTENBERG_MAC_SIGNING=developer-id needs ${missing.join(', ')}`)
  return ['--config', 'electron-builder.developer-id.yml', ...args]
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  let args
  try {
    args = builderArgs(process.argv.slice(2), process.env)
  } catch (err) {
    console.error(`builder: ${err.message}`)
    process.exit(1)
  }
  const run = spawnSync('npx', ['electron-builder', ...args], { stdio: 'inherit', shell: process.platform === 'win32' })
  process.exit(run.status ?? 1)
}
