import { describe, expect, it } from 'vitest'
import { interfaceZoom } from '@shared/zoom'

describe('interfaceZoom (US16.1)', () => {
  it.each([
    [1920, 1200, 1.333],
    [1920, 1080, 1.333],
    [1536, 864, 1.067],
    [1280, 720, 1],
    [1024, 640, 1],
    [2560, 1440, 1.333]
  ])('%i×%i → %f', (w, h, zoom) => expect(interfaceZoom(w, h)).toBe(zoom))

  it('the logical area is at least 1440×810 from 1536 px up', () => {
    for (const [w, h] of [[1920, 1080], [1536, 864]]) {
      const z = interfaceZoom(w, h)
      expect(Math.round(w / z)).toBeGreaterThanOrEqual(1440)
      expect(Math.round(h / z)).toBeGreaterThanOrEqual(810)
    }
  })
})
