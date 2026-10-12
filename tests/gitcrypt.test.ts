import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Guarda do requisito "dados cifrados no repositório público" (docs/DADOS.md → git-crypt).
const root = join(__dirname, '..')
const git = (...args: string[]) => execFileSync('git', args, { cwd: root })
const GITCRYPT_HEADER = Buffer.from('\0GITCRYPT\0')

describe('git-crypt', () => {
  it('.gitattributes cifra data/canonical/**', () => {
    const attrs = readFileSync(join(root, '.gitattributes'), 'utf8')
    expect(attrs).toMatch(/^data\/canonical\/\*\* filter=git-crypt diff=git-crypt$/m)
  })

  it('todo arquivo de data/canonical/ está cifrado no git (índice)', () => {
    const files = git('ls-files', '-z', 'data/canonical').toString().split('\0').filter(Boolean)
    expect(files.length).toBeGreaterThan(0)
    for (const f of files) {
      const blob = git('cat-file', 'blob', `:${f}`)
      expect(blob.subarray(0, GITCRYPT_HEADER.length).equals(GITCRYPT_HEADER), f).toBe(true)
    }
  })
})
