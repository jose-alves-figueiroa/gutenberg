/**
 * Apresentar › Faixas (design v2, PLAN.md → E18): the bands to send (services, sacraments and the
 * sermon of the service being presented) and "Tirar faixa". A band goes to the "Faixas" output
 * and clears the text screen; it stays until another band, a text screen or "Tirar faixa".
 */
import { useQuery } from '@tanstack/react-query'
import { bandChoices, sameBand, type Band, type Kickers } from '@shared/bands'
import { t } from '@shared/i18n'
import type { PresentCommand } from '@shared/presentation'
import { json, useApi } from '../../api'

export const kickers = (): Kickers => ({ service: t('bands.kind.service'), sacrament: t('bands.kind.sacrament'), sermon: t('bands.kind.sermon') })

export function BandsPanel({ serviceId, onAir, command }: { serviceId: number | null; onAir: Band | null; command: (cmd: PresentCommand) => void }) {
  const api = useApi()
  const library = useQuery({ queryKey: ['bands'], queryFn: () => json(api.api.v1.bands.$get()) })
  const sermon = useQuery({
    queryKey: ['sermon', serviceId],
    enabled: serviceId !== null,
    queryFn: () => json(api.api.v1.liturgy.services[':id'].sermon.$get({ param: { id: String(serviceId) } }))
  })
  const bands = library.data ? bandChoices(library.data, sermon.data ?? null, kickers(), new Date()) : []
  return (
    <>
      <p className="text-muted out-note">{t('present.bandsNote')}</p>
      <div className="pres-bands">
        {library.data && bands.length === 0 && <p className="empty-note">{t('present.noBands')}</p>}
        {bands.map((b) => {
          const live = sameBand(b, onAir)
          return (
            <button
              key={`${b.kind}:${b.title}:${b.subtitle}`}
              type="button"
              className={live ? 'pres-band pres-band--live' : 'pres-band'}
              aria-pressed={live}
              onClick={() => command({ type: 'band', band: b })}
            >
              <span className="pres-slide-top">
                <span className="text-muted">{b.kicker}</span>
                <span className={live ? 'pres-live' : 'pres-next'}>{live ? t('present.onAir') : t('present.send')}</span>
              </span>
              <span className="pres-band-title">{b.title}</span>
              {b.subtitle && <span className="pres-band-sub">{b.subtitle}</span>}
            </button>
          )
        })}
      </div>
      <div className="pres-bar">
        <button type="button" className="btn btn-secondary pres-prev" disabled={!onAir} onClick={() => command({ type: 'clearBand' })}>
          {t('present.clearBand')}
        </button>
      </div>
    </>
  )
}
