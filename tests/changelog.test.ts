import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '..')
const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8')
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string }

describe('CHANGELOG.md', () => {
  it('keeps an unreleased section on top of the released versions', () => {
    const headings = [...changelog.matchAll(/^## \[(.+?)\]/gm)].map((m) => m[1])
    expect(headings[0]).toBe('Não lançado')
    expect(headings.slice(1).every((h) => /^\d+\.\d+\.\d+$/.test(h))).toBe(true)
  })

  it('has an entry for the package version, with its date', () => {
    expect(changelog).toMatch(new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\] — \\d{4}-\\d{2}-\\d{2}$`, 'm'))
  })

  it('uses only the known groups', () => {
    const groups = [...changelog.matchAll(/^### (.+)$/gm)].map((m) => m[1])
    for (const g of groups) expect(['Adicionado', 'Alterado', 'Corrigido', 'Removido', 'Segurança']).toContain(g)
  })
})
