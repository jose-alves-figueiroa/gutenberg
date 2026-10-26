// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE, toPayload } from '@shared/payload'
import { overlayHtml } from '../src/main/server/overlay'

const slide = { header: 'Hebreus 12.15 (2/3)', lines: ['nem haja alguma raiz de amargura que,', 'brotando, vos perturbe,'] }

/** Loads the page into this jsdom document and runs its script, at `/overlay/bible?preview`. */
function openPreview() {
  const html = overlayHtml('bible')
  window.history.replaceState(null, '', '/overlay/bible?preview')
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'))
  new Function(html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>')))()
}

describe('overlay page (US15.1)', () => {
  it('has no external resources', () => expect(overlayHtml('bible')).not.toMatch(/https?:\/\//))

  it('draws a posted map in preview mode', async () => {
    openPreview()
    window.postMessage(toPayload({ collection: 'bible:ara', slide }, DEFAULT_STYLE, 1), '*')
    await new Promise((r) => setTimeout(r, 20))
    expect(document.getElementById('wrap')!.className).toBe('')
    const band = document.getElementById('band')!
    expect([...band.querySelectorAll('span')].map((s) => s.textContent)).toEqual(['Hebreus 12.15 (2/3)', ...slide.lines])
    expect(Math.round((parseFloat(band.style.fontSize) * 1080) / 100)).toBe(69)
  })
})
