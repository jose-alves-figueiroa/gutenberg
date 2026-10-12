/**
 * Present tab (README → "Apresentar"): the sequence on the left (the ad hoc item on top), the
 * viewed item's screens, and Anterior / Próximo. The state lives in the main process.
 */
import { ArrowLeftIcon, ArrowRightIcon, EyeSlashIcon, XIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { t } from '@shared/i18n'
import { usePresent } from '../../present'

export function PresentView() {
  const { view, command } = usePresent()
  // Item being looked at; null follows the item on the air.
  const [picked, setPicked] = useState<number | null>(null)
  const items = view?.items ?? []
  const state = view?.state
  const live = state?.live ?? 0
  const viewed = picked !== null && picked < items.length ? picked : live
  const item = items[viewed]

  const go = (index: number, slide: number) => {
    setPicked(null)
    command({ type: 'go', index, slide })
  }
  const step = (delta: -1 | 1) => {
    setPicked(null)
    command({ type: 'step', delta })
  }

  // ← / → (and PageUp / PageDown, as presentation remotes send) outside text fields.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        setPicked(null)
        command({ type: 'step', delta: 1 })
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        setPicked(null)
        command({ type: 'step', delta: -1 })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [command])

  let nextHint = ''
  const current = items[live]
  if (current && state) {
    const following = items[live + 1]
    nextHint =
      state.slide + 1 < current.slides.length
        ? current.slides[state.slide + 1].lines[0]
        : following
          ? `${following.adhoc ? t('present.adhoc') : following.moment || '—'} — ${following.title}`
          : t('present.end')
  }

  return (
    <main className="view view--present" role="tabpanel" id="view-present" aria-labelledby="tab-present">
      <div className="view-grid view-grid--present">
        <aside className="pres-aside" aria-label={t('present.aside')}>
          <h6 className="text-muted">{view?.service?.name ?? t('present.aside')}</h6>
          {items.map((it, i) => (
            <div key={`${i}:${it.collection}:${it.itemRef}`} className="pres-item" aria-current={i === viewed}>
              <button type="button" className="pres-item-pick" onClick={() => setPicked(i)}>
                <span className="pres-item-top">
                  <span className={it.adhoc ? 'pres-moment pres-moment--adhoc' : 'pres-moment'}>{it.adhoc ? t('present.adhoc') : it.moment || '—'}</span>
                  {i === live && !state?.blank && <span className="pres-live">{t('present.onAir')}</span>}
                </span>
                <span className="pres-item-title">{it.title}</span>
                <span className="text-muted pres-item-col">{it.collectionLabel}</span>
              </button>
              {it.adhoc && (
                <button
                  type="button"
                  className="btn btn-ghost btn-icon pres-drop"
                  title={t('present.dropAdhoc')}
                  aria-label={t('present.dropAdhoc')}
                  onClick={() => {
                    setPicked(null)
                    command({ type: 'dropAdhoc' })
                  }}
                >
                  <XIcon size={16} weight="duotone" />
                </button>
              )}
            </div>
          ))}
          {view && items.length === 0 && <p className="empty-note">{t('present.noItems')}</p>}
        </aside>
        <section className="pres-main">
          <div className="pres-head">
            <div className="pres-head-text">
              <div className="lit-kicker">{item ? `${item.adhoc ? t('present.adhoc') : item.moment || '—'} · ${item.collectionLabel}` : ''}</div>
              <h2 className="pres-title">{item ? item.title : t('present.emptyLiturgy')}</h2>
            </div>
            <button type="button" className="btn btn-secondary" disabled={!state} onClick={() => state && command({ type: 'blank', blank: !state.blank })}>
              <EyeSlashIcon size={17} weight="duotone" aria-hidden />
              {state?.blank ? t('present.show') : t('present.blank')}
            </button>
          </div>
          <div className="pres-slides">
            {item?.slides.map((s, i) => {
              const onAir = viewed === live && i === state?.slide && !state.blank
              const upNext = viewed === live && i === (state?.slide ?? 0) + 1
              return (
                <button key={i} type="button" className={onAir ? 'pres-slide pres-slide--live' : 'pres-slide'} aria-pressed={onAir} onClick={() => go(viewed, i)}>
                  <span className="pres-slide-top">
                    <span className="text-muted">{s.header}</span>
                    {onAir && <span className="pres-live">{t('present.onAir')}</span>}
                    {!onAir && upNext && <span className="pres-next">{t('present.upNext')}</span>}
                  </span>
                  <span className="pres-slide-text">{s.lines.join('\n')}</span>
                </button>
              )
            })}
          </div>
          <div className="pres-bar">
            <button type="button" className="btn btn-secondary pres-prev" disabled={items.length === 0} onClick={() => step(-1)}>
              <ArrowLeftIcon size={20} weight="duotone" aria-hidden />
              {t('present.prev')}
            </button>
            <button type="button" className="btn btn-primary pres-next-btn" disabled={items.length === 0} onClick={() => step(1)}>
              <span className="pres-next-label">
                {t('present.next')}
                <ArrowRightIcon size={20} weight="duotone" aria-hidden />
              </span>
              <span className="pres-next-hint">{nextHint}</span>
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}
