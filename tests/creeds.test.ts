import { describe, expect, it } from 'vitest'
import { validateCreeds } from '@shared/validate'
import { parseCreedsText } from '../scripts/lib/translate/creeds'

describe('parseCreedsText', () => {
  const text = [
    'Notas antes do primeiro título são ignoradas.',
    '## Credo Apostólico',
    'Creio em Deus Pai,',
    'todo-poderoso.',
    '',
    'Creio em Jesus Cristo.',
    '',
    '## Credo Niceno',
    'Cremos em um só Deus.',
    '## Credo Atanasiano',
    'Todo aquele que quiser ser salvo…'
  ].join('\r\n')

  it('reads the three creeds as prose paragraphs with stable ids', () => {
    const creeds = parseCreedsText(text)
    expect(creeds).toEqual([
      { id: 'apostles', title: 'Credo Apostólico', text: 'Creio em Deus Pai, todo-poderoso.\n\nCreio em Jesus Cristo.' },
      { id: 'nicene', title: 'Credo Niceno', text: 'Cremos em um só Deus.' },
      { id: 'athanasian', title: 'Credo Atanasiano', text: 'Todo aquele que quiser ser salvo…' }
    ])
    expect(validateCreeds({ format: 1, creeds, source: { name: 'manual' } })).toEqual([])
  })

  it('rejects unknown, duplicated or empty creeds', () => {
    expect(() => parseCreedsText('## Catecismo de Heidelberg\nx')).toThrow(/unknown creed/)
    expect(parseCreedsText('## Credo de Atanásio\nTexto.')[0].id).toBe('athanasian')
    expect(() => parseCreedsText('## Credo Niceno\na\n## Credo Niceno\nb')).toThrow(/twice/)
    expect(() => parseCreedsText('## Credo Atanasiano\n\n')).toThrow(/no text/)
  })
})
