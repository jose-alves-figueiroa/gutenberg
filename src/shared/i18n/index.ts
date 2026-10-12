/**
 * Minimal i18n: code and data use English keys; user-facing text comes from a locale dictionary.
 * Only pt-BR exists today; add a dictionary with the same keys to support another locale.
 */
import { ptBR } from './pt-BR'

export type Messages = Record<keyof typeof ptBR, string>
export type MessageKey = keyof Messages
export type Locale = 'pt-BR'

const MESSAGES: Record<Locale, Messages> = { 'pt-BR': ptBR }

let locale: Locale = 'pt-BR'

export function setLocale(next: Locale): void {
  locale = next
}

export function getLocale(): Locale {
  return locale
}

/** Translates `key`, replacing `{name}` placeholders with `vars`. */
export function t(key: MessageKey, vars: Record<string, string | number> = {}): string {
  return MESSAGES[locale][key].replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match
  )
}
