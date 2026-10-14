import { describe, expect, it } from 'vitest'
import { getLocale, t } from '@shared/i18n'
import { ptBR } from '@shared/i18n/pt-BR'

describe('i18n', () => {
  it('defaults to pt-BR', () => {
    expect(getLocale()).toBe('pt-BR')
  })

  it('has a non-empty string for every key', () => {
    for (const [key, value] of Object.entries(ptBR)) expect(value.trim(), key).not.toBe('')
  })

  it('uses English keys only', () => {
    for (const key of Object.keys(ptBR)) expect(key, key).toMatch(/^[a-zA-Z.]+$/)
  })

  it('has no em dash in any text (the operator asked for none)', () => {
    for (const [key, value] of Object.entries(ptBR)) expect(value, key).not.toContain('\u2014')
  })

  it('fills placeholders and leaves unknown ones untouched', () => {
    expect(t('slide.confession', { name: 'CFW', chapter: 1, section: 2 })).toBe('CFW 1.2')
    expect(t('slide.songLabeled', { label: 'Salmo', number: 133 })).toBe('Salmo 133{version}')
  })
})
