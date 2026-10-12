import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Guards the "data encrypted in the public repository" requirement (docs/DATA.md → git-crypt).
const root = join(__dirname, '..')
const git = (...args: string[]) => execFileSync('git', args, { cwd: root })
const GITCRYPT_HEADER = Buffer.from('\0GITCRYPT\0')

describe('git-crypt', () => {
  it('.gitattributes encrypts data/canonical/**', () => {
    const attrs = readFileSync(join(root, '.gitattributes'), 'utf8')
    expect(attrs).toMatch(/^data\/canonical\/\*\* filter=git-crypt diff=git-crypt$/m)
  })

  it('every file under data/canonical/ is encrypted in git (index)', () => {
    const files = git('ls-files', '-z', 'data/canonical').toString().split('\0').filter(Boolean)
    expect(files.length).toBeGreaterThan(0)
    // One `git cat-file --batch` for all blobs: "<sha> blob <size>\n<content>\n" per file.
    const out = execFileSync('git', ['cat-file', '--batch'], { cwd: root, input: files.map((f) => `:${f}`).join('\n') + '\n', maxBuffer: 1 << 30 })
    let at = 0
    for (const f of files) {
      const nl = out.indexOf(0x0a, at)
      const [, type, size] = out.subarray(at, nl).toString().split(' ')
      expect(type, f).toBe('blob')
      const blob = out.subarray(nl + 1, nl + 1 + Number(size))
      expect(blob.subarray(0, GITCRYPT_HEADER.length).equals(GITCRYPT_HEADER), f).toBe(true)
      at = nl + 1 + Number(size) + 1
    }
  })
})
