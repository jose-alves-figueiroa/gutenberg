import { describe, expect, it } from 'vitest'
import { releaseNotes } from '../scripts/lib/release-notes'

const changelog = `# Changelog

## [Não lançado]

### Adicionado
- Algo novo (E9)

## [0.2.0] — 2026-11-01

### Corrigido
- Um erro (E9)

## [0.1.0] — 2026-10-13

### Adicionado
- Primeira versão (E1)
`

describe('release notes from CHANGELOG.md', () => {
  it('takes the section of the version, up to the next one', () => {
    expect(releaseNotes(changelog, '0.2.0')).toBe('### Corrigido\n- Um erro (E9)')
    expect(releaseNotes(changelog, '0.1.0')).toBe('### Adicionado\n- Primeira versão (E1)')
  })

  it('fails when the version was not closed in the changelog', () => {
    expect(() => releaseNotes(changelog, '0.3.0')).toThrow(/no section for 0\.3\.0/)
    expect(() => releaseNotes('## [1.0.0] — 2026-12-01\n\n## [0.1.0] — x\n- a', '1.0.0')).toThrow(/empty/)
  })
})
