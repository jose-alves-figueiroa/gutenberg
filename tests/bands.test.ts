import { describe, expect, it } from 'vitest'
import { BandLibrary, DEFAULT_BANDS, entryBand, longDate, sermonBand, type Band } from '@shared/bands'
import { DEFAULT_OUTPUTS, outputPayload } from '@shared/outputs'
import { applyCommand, INITIAL_PRESENTATION, PresentationStateSchema } from '@shared/presentation'

const band: Band = { kind: 'service', kicker: 'Culto', title: 'Culto Matutino', subtitle: 'Domingo, 12 de outubro' }
const counts = [3, 2]

describe('bands on the air (US18.2, decisions 1 and 2)', () => {
  it('sending a band clears the text; a text screen takes the band off', () => {
    const on = applyCommand({ ...INITIAL_PRESENTATION, slide: 1 }, { type: 'band', band }, counts)
    expect(on).toMatchObject({ band, blank: true, slide: 1 })
    expect(applyCommand(on, { type: 'step', delta: 1 }, counts)).toMatchObject({ band: null, blank: false, slide: 2 })
    expect(applyCommand(on, { type: 'go', index: 1, slide: 0 }, counts)).toMatchObject({ band: null, blank: false })
    expect(applyCommand(on, { type: 'blank', blank: false }, counts)).toMatchObject({ band: null, blank: false })
  })

  it('the band stays until "Tirar faixa" (no timer); clearing keeps the text screen clear', () => {
    const on = applyCommand(INITIAL_PRESENTATION, { type: 'band', band }, counts)
    expect(applyCommand(on, { type: 'blank', blank: true }, counts).band).toEqual(band)
    const off = applyCommand(on, { type: 'clearBand' }, counts)
    expect(off).toMatchObject({ band: null, blank: true, seq: on.seq + 1 })
    expect(applyCommand(off, { type: 'clearBand' }, counts)).toBe(off)
  })

  it('a state saved before E18 has no band', () => {
    const old: Partial<typeof INITIAL_PRESENTATION> = { ...INITIAL_PRESENTATION }
    delete old.band
    expect(PresentationStateSchema.parse(old).band).toBeNull()
  })
})

describe('band payload (US18.2)', () => {
  const [bible, , , faixas] = DEFAULT_OUTPUTS

  it('goes only to the outputs bound to bands; the others are clear', () => {
    const source = { collection: 'bible:ara', slide: { header: 'Hb 12.1', lines: ['a'] }, band }
    expect(outputPayload(source, faixas, DEFAULT_OUTPUTS, 7).map).toMatchObject({
      type: 'BAND',
      kind: 'service',
      kicker: 'Culto',
      title: 'Culto Matutino',
      subtitle: 'Domingo, 12 de outubro',
      lines: ['Culto Matutino', 'Domingo, 12 de outubro'],
      text: 'Culto Matutino\nDomingo, 12 de outubro',
      seq: 7
    })
    expect(outputPayload(source, bible, DEFAULT_OUTPUTS, 7).map).toMatchObject({ type: 'CLEAR', text: '' })
  })

  it('without a band the Faixas output is clear', () => {
    expect(outputPayload({ collection: 'bible:ara', slide: { header: 'x', lines: ['y'] } }, faixas, DEFAULT_OUTPUTS, 1).map.type).toBe('CLEAR')
  })
})

describe('band lists (US18.1)', () => {
  it('the default lists are valid data', () => expect(BandLibrary.parse(DEFAULT_BANDS)).toEqual(DEFAULT_BANDS))

  it('a service band without a supporting line takes the date', () => {
    const sunday = new Date(2026, 9, 11)
    expect(longDate(sunday)).toBe('Domingo, 11 de outubro')
    expect(entryBand('service', 'Culto', DEFAULT_BANDS.services[0], sunday)).toEqual({ kind: 'service', kicker: 'Culto', title: 'Culto Matutino', subtitle: 'Domingo, 11 de outubro' })
    expect(entryBand('sacrament', 'Sacramento', DEFAULT_BANDS.sacraments[0], sunday).subtitle).toBe('')
  })

  it('the sermon band: preacher, then title and text', () => {
    expect(sermonBand('Pregação', { preacher: 'Rev. Ashbel Green Simonton', title: 'A graça que educa', text: 'Tito 2.11–14' })).toEqual({
      kind: 'sermon',
      kicker: 'Pregação',
      title: 'Rev. Ashbel Green Simonton',
      subtitle: '“A graça que educa” · Tito 2.11–14'
    })
    expect(sermonBand('Pregação', { preacher: '', title: 'x', text: '' })).toBeNull()
  })
})
