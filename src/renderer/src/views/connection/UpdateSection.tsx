/** Updates in the Connection tab (PLAN.md → US10.3, US13.1): installed version, check, progress, restart. */
import { ArrowsClockwiseIcon } from '@phosphor-icons/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { t } from '@shared/i18n'
import type { UpdateState } from '@shared/update'
import { json, useApi } from '../../api'
import { useUpdate } from '../../update'

export function updateText(s: UpdateState): string {
  switch (s.status) {
    case 'idle':
      return t('update.status.idle')
    case 'checking':
      return t('update.status.checking')
    case 'current':
      return t('update.status.current')
    case 'available':
      return s.error ? t('update.status.downloadError', { v: s.latest ?? '', message: s.error }) : t('update.status.available', { v: s.latest ?? '' })
    case 'downloading':
      return t('update.status.downloading', { v: s.latest ?? '', percent: s.percent ?? 0 })
    case 'ready':
      return t(s.mode === 'dmg' ? 'update.status.readyDmg' : 'update.status.ready', { v: s.latest ?? '' })
    case 'error':
      return t('update.status.error', { message: s.error ?? '' })
  }
}

export function UpdateSection() {
  const api = useApi()
  const qc = useQueryClient()
  const update = useUpdate().data
  const check = useMutation({
    mutationFn: () => json(api.api.v1.update.check.$post()),
    onSuccess: (s) => qc.setQueryData(['update'], s)
  })
  const install = useMutation({ mutationFn: () => api.api.v1.update.install.$post() })
  if (!update) return null
  return (
    <section className="con-update" aria-label={t('update.title')}>
      <h6 className="text-muted">{t('update.title')}</h6>
      <dl className="con-dl">
        <dt className="text-muted">{t('update.installed')}</dt>
        <dd>{update.version}</dd>
        <dt className="text-muted">{t('update.state')}</dt>
        <dd role="status">{update.mode === 'off' ? t('update.status.off') : updateText(update)}</dd>
      </dl>
      {update.mode !== 'off' && (
        <div className="con-actions">
          {update.status === 'ready' && (
            <button type="button" className="btn btn-primary" disabled={install.isPending} onClick={() => install.mutate()}>
              <ArrowsClockwiseIcon size={16} weight="duotone" aria-hidden />
              {t('update.install')}
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            disabled={check.isPending || update.status === 'checking' || update.status === 'downloading' || update.status === 'ready'}
            onClick={() => check.mutate()}
          >
            {t('update.check')}
          </button>
        </div>
      )}
      {update.mode !== 'off' && <p className="text-muted con-foot">{t(update.mode === 'dmg' ? 'update.footDmg' : 'update.foot')}</p>}
    </section>
  )
}
