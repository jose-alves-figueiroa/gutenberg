// Password-protected git-crypt key (docs/DATA.md → git-crypt).
//
//   npm run data:key      exports the key of the unlocked repository and (re)creates
//                         .secrets/gutenberg-data.key.gpg encrypted with GUTENBERG_DATA_PASSWORD
//   npm run data:unlock   decrypts .secrets/gutenberg-data.key.gpg with the password and runs
//                         `git-crypt unlock` (no-op when already unlocked)
//
// The password comes from GUTENBERG_DATA_PASSWORD (environment or .env). The plaintext key only
// exists in a temporary 0600 file that is removed at the end.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const KEY_GPG = join(ROOT, '.secrets', 'gutenberg-data.key.gpg')
const UNLOCKED_MARK = join(ROOT, '.git', 'git-crypt', 'keys', 'default')

function fail(msg) {
  console.error(`data-key: ${msg}`)
  process.exit(1)
}

function password() {
  if (!process.env.GUTENBERG_DATA_PASSWORD && existsSync(join(ROOT, '.env'))) process.loadEnvFile(join(ROOT, '.env'))
  const pw = process.env.GUTENBERG_DATA_PASSWORD
  if (!pw) fail('set GUTENBERG_DATA_PASSWORD in the environment or in .env (see .env.example)')
  return pw
}

function withTempKey(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'gutenberg-key-'))
  const file = join(dir, 'key')
  try {
    return fn(file)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const gpg = (args, input) =>
  execFileSync('gpg', ['--batch', '--yes', '--quiet', '--pinentry-mode', 'loopback', '--passphrase-fd', '0', ...args], {
    input,
    stdio: ['pipe', 'pipe', 'inherit']
  })

const isUnlocked = () => existsSync(UNLOCKED_MARK)

function key() {
  if (!isUnlocked()) fail('repository is locked: run `npm run data:unlock` before regenerating the key')
  const pw = password()
  withTempKey((file) => {
    execFileSync('git-crypt', ['export-key', file], { cwd: ROOT })
    execFileSync('mkdir', ['-p', join(ROOT, '.secrets')])
    gpg(['--symmetric', '--cipher-algo', 'AES256', '-o', KEY_GPG, file], pw)
    execFileSync('chmod', ['600', KEY_GPG])
    // Check that the password opens what was just written.
    const back = gpg(['-d', KEY_GPG], pw)
    const orig = execFileSync('cat', [file])
    if (!back.equals(orig)) fail('verification failed: the new .gpg does not decrypt to the same key')
  })
  console.log(`data-key: encrypted key written to ${KEY_GPG}`)
}

function unlock() {
  if (isUnlocked()) return console.log('data-key: repository already unlocked')
  if (!existsSync(KEY_GPG)) fail(`key not found at ${KEY_GPG} — copy the .gpg into .secrets/`)
  const pw = password()
  withTempKey((file) => {
    let plain
    try {
      plain = gpg(['-d', KEY_GPG], pw)
    } catch {
      fail('could not decrypt the key — check GUTENBERG_DATA_PASSWORD')
    }
    writeFileSync(file, plain, { mode: 0o600 })
    execFileSync('git-crypt', ['unlock', file], { cwd: ROOT, stdio: 'inherit' })
  })
  console.log('data-key: repository unlocked')
}

const cmd = process.argv[2]
if (cmd === 'key') key()
else if (cmd === 'unlock') unlock()
else fail('usage: node scripts/data-key.mjs <key|unlock>')
