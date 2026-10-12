import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const dir = join(__dirname, '../src/renderer/src/styles')
const css = Object.fromEntries(readdirSync(dir).map((f) => [f, readFileSync(join(dir, f), 'utf8')]))
const html = readFileSync(join(__dirname, '../src/renderer/index.html'), 'utf8')

describe('Broadsheet styles', () => {
  it('reference no external URLs (the app runs offline)', () => {
    for (const [file, src] of Object.entries({ ...css, 'index.html': html })) {
      // Loopback is allowed (the CSP lets the UI reach the local HTTP API); anything else is external.
      expect(src.replace(/http:\/\/127\.0\.0\.1(:\*|:\d+)?/g, ''), file).not.toMatch(/https?:\/\//)
      expect(src, file).not.toMatch(/@import/)
    }
  })

  it.each([
    ['--color-bg', '#f3f2f2'],
    ['--color-surface', '#eae9e9'],
    ['--color-text', '#201e1d'],
    ['--color-accent', '#0088b0'],
    ['--color-accent-100', '#e9f8ff'],
    ['--color-accent-200', '#cbeeff'],
    ['--color-accent-700', '#006786'],
    ['--color-accent-2', '#d6006c'],
    ['--color-accent-2-700', '#aa0b56'],
    ['--color-neutral-500', '#9b9797'],
    ['--color-neutral-600', '#7d7979'],
    ['--space-8', '40.0px']
  ])('token %s = %s', (name, value) => {
    expect(css['tokens.css']).toContain(`${name}: ${value};`)
  })

  it('uses Source Serif 4 everywhere', () => {
    expect(css['tokens.css']).toMatch(/--font-body: "Source Serif 4"/)
    expect(css['tokens.css']).toMatch(/--font-heading: "Source Serif 4"/)
  })

  it('applies the README focus, hover and disabled states', () => {
    expect(css['components.css']).toMatch(/:focus-visible \{ outline: 2px solid var\(--color-accent\); outline-offset: 2px; \}/)
    expect(css['app.css']).toMatch(/opacity: 0\.45/)
    expect(css['app.css']).toMatch(/background: var\(--color-accent-100\)/)
  })

  it('stacks the columns below 1100px', () => {
    expect(css['app.css']).toMatch(/@media \(max-width: 1099px\)/)
  })
})
