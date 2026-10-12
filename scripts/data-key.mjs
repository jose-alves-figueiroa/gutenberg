// Chave do git-crypt protegida por senha (docs/DADOS.md → git-crypt).
//
//   npm run data:key      exporta a chave do repositório destrancado e (re)gera
//                         .secrets/gutenberg-data.key.gpg cifrado com GUTENBERG_DATA_PASSWORD
//   npm run data:unlock   decifra .secrets/gutenberg-data.key.gpg com a senha e roda
//                         `git-crypt unlock` (nada a fazer se já estiver destrancado)
//
// A senha vem de GUTENBERG_DATA_PASSWORD (variável de ambiente ou .env). A chave em claro
// só existe num arquivo temporário (0600) apagado ao final.
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
  if (!pw) fail('defina GUTENBERG_DATA_PASSWORD no ambiente ou no .env (ver .env.example)')
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
  if (!isUnlocked()) fail('repositório trancado: rode `npm run data:unlock` antes de regenerar a chave')
  const pw = password()
  withTempKey((file) => {
    execFileSync('git-crypt', ['export-key', file], { cwd: ROOT })
    execFileSync('mkdir', ['-p', join(ROOT, '.secrets')])
    gpg(['--symmetric', '--cipher-algo', 'AES256', '-o', KEY_GPG, file], pw)
    execFileSync('chmod', ['600', KEY_GPG])
    // Confere que a senha abre o que acabou de ser gerado.
    const back = gpg(['-d', KEY_GPG], pw)
    const orig = execFileSync('cat', [file])
    if (!back.equals(orig)) fail('verificação falhou: o .gpg gerado não decifra para a mesma chave')
  })
  console.log(`data-key: chave cifrada em ${KEY_GPG}`)
}

function unlock() {
  if (isUnlocked()) return console.log('data-key: repositório já destrancado')
  if (!existsSync(KEY_GPG)) fail(`chave não encontrada em ${KEY_GPG} — copie o .gpg para .secrets/`)
  const pw = password()
  withTempKey((file) => {
    let plain
    try {
      plain = gpg(['-d', KEY_GPG], pw)
    } catch {
      fail('não consegui decifrar a chave — confira GUTENBERG_DATA_PASSWORD')
    }
    writeFileSync(file, plain, { mode: 0o600 })
    execFileSync('git-crypt', ['unlock', file], { cwd: ROOT, stdio: 'inherit' })
  })
  console.log('data-key: repositório destrancado')
}

const cmd = process.argv[2]
if (cmd === 'key') key()
else if (cmd === 'unlock') unlock()
else fail('uso: node scripts/data-key.mjs <key|unlock>')
