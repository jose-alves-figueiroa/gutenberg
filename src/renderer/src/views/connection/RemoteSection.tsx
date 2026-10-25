/**
 * Conexão › Controle remoto (design v2, PLAN.md → E17): the QR code of `/control`, the PIN the
 * phone types and the paired device, with Revogar. Only one device at a time (decision 4).
 */
import { DeviceMobileIcon } from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { t } from '@shared/i18n'
import { json, useApi } from '../../api'

/** The PIN refreshes on its own when it expires (5 minutes), so the screen never shows a dead one. */
const REFRESH_MS = 30_000

const seen = (lastSeen: number, now = Date.now()) =>
  now - lastSeen < 2 * 60_000
    ? t('remote.seenNow')
    : t('remote.seenAt', { time: new Date(lastSeen).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) })

export function RemoteSection() {
  const api = useApi()
  const qc = useQueryClient()
  const info = useQuery({ queryKey: ['remote'], queryFn: () => json(api.api.v1.remote.$get()), refetchInterval: REFRESH_MS })
  const set = (data: unknown) => qc.setQueryData(['remote'], data)
  const newPin = useMutation({ mutationFn: () => json(api.api.v1.remote.pin.$post()), onSuccess: set })
  const revoke = useMutation({
    mutationFn: (id: string) => json(api.api.v1.remote.devices[':id'].$delete({ param: { id } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['remote'] })
  })
  const d = info.data
  return (
    <div className="view-grid view-grid--connection remote">
      <section className="con-col" aria-label={t('remote.pairTitle')}>
        <h6 className="text-muted">{t('remote.pairTitle')}</h6>
        <p className="con-foot remote-hint">{t('remote.pairHint')}</p>
        <div className="remote-pair">
          {/* SVG made by the main process (qrcode), from the app's own address: trusted markup. */}
          <div className="remote-qr" role="img" aria-label={t('remote.qr')} dangerouslySetInnerHTML={{ __html: d?.qr ?? '' }} />
          <div className="remote-pin-col">
            <span className="text-muted remote-label">{t('remote.pin')}</span>
            <span className="remote-pin" aria-live="polite">
              {d ? `${d.pin.slice(0, 3)} ${d.pin.slice(3)}` : '…'}
            </span>
            <span className="text-muted remote-label">{t('remote.pinValid')}</span>
            <button type="button" className="btn btn-secondary" disabled={newPin.isPending} onClick={() => newPin.mutate()}>
              {t('remote.newPin')}
            </button>
          </div>
        </div>
        {d && <code className="remote-url">{d.url}</code>}
      </section>
      <section className="con-col" aria-label={t('remote.devices')}>
        <h6 className="text-muted">{t('remote.devices')}</h6>
        {d && d.devices.length === 0 && <p className="empty-note">{t('remote.noDevices')}</p>}
        {d?.devices.map((dev) => (
          <div key={dev.id} className="remote-device">
            <DeviceMobileIcon size={22} weight="duotone" aria-hidden />
            <span className="remote-device-text">
              <span className="remote-device-name">{dev.name}</span>
              <span className="text-muted remote-label">{t('remote.seen', { platform: dev.platform || t('control.device'), when: seen(dev.lastSeen) })}</span>
            </span>
            <button type="button" className="btn btn-ghost" onClick={() => revoke.mutate(dev.id)}>
              {t('remote.revoke')}
            </button>
          </div>
        ))}
        <p className="text-muted con-foot">{t('remote.revokeHint')}</p>
        <p className="text-muted con-foot">{t('remote.oneDevice')}</p>
      </section>
    </div>
  )
}
