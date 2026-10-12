/**
 * Connection tab (README → Conexão; PLAN.md → US7.2): the state of OBS, this computer's address
 * and port, "Testar", the event log and the outputs (one Browser Source each), which the operator
 * sets up here.
 */
import { ArrowsClockwiseIcon, CopyIcon, PlusIcon, PulseIcon } from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { LogEntry } from '@shared/connection'
import { t } from '@shared/i18n'
import { DEFAULT_OUTPUTS, Outputs, type Output } from '@shared/outputs'
import { DEFAULT_STYLE } from '@shared/payload'
import { json, useApi } from '../../api'
import { useConnection } from '../../connection'
import { CONN_VIEW } from '../../tabs'
import { OutputEditor, kindLabel } from './OutputEditor'

const hhmm = (time: number) => new Date(time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export function logText(e: LogEntry): string {
  const output = e.output || t('connection.allOutputs')
  switch (e.kind) {
    case 'connected':
      return t('connection.log.connected', { ip: e.ip ?? '', output })
    case 'unstable':
      return t('connection.log.unstable', { ip: e.ip ?? '', output, ms: e.ms ?? '—' })
    case 'lost':
      return t('connection.log.lost', { ip: e.ip ?? '', output })
    case 'test':
      return e.clients ? t('connection.log.test', { n: e.clients, ms: e.ms ?? '—' }) : t('connection.log.testNone')
    case 'port':
      return t('connection.log.port', { port: e.port ?? '' })
    case 'portError':
      return t('connection.log.portError', { port: e.port ?? '' })
  }
}

export function ConnectionView() {
  const api = useApi()
  const qc = useQueryClient()
  const conn = useConnection()
  const data = conn.data
  const refresh = () => qc.invalidateQueries({ queryKey: ['connection'] })
  const [port, setPort] = useState<string | null>(null)
  const [portError, setPortError] = useState('')
  const applyPort = useMutation({
    mutationFn: async (p: number) => {
      const res = await api.api.v1.connection.port.$post({ json: { port: p } })
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? res.statusText)
    },
    onSuccess: () => {
      setPort(null)
      setPortError('')
      void refresh()
    },
    onError: (err) => {
      setPortError((err as Error).message)
      void refresh()
    }
  })
  const test = useMutation({ mutationFn: () => json(api.api.v1.connection.test.$post()), onSuccess: refresh })

  const status = data?.status ?? 'offline'
  const c = CONN_VIEW[status]
  const clients = data ? [...data.outputs.flatMap((o) => o.clients), ...data.all.clients] : []
  const obsIp = clients.find((x) => x.status !== 'offline')?.ip ?? null
  const portValue = port ?? String(data?.port ?? '')
  const host = data?.addresses[0] ?? '127.0.0.1'
  const base = data ? `http://${host}:${data.port}` : ''
  const lastSent = data?.lastSent ? `${data.lastSent.header ?? t('connection.cleared')} · ${hhmm(data.lastSent.time)}` : '—'

  return (
    <main className="view" role="tabpanel" id="view-connection" aria-labelledby="tab-connection">
      <div className="view-grid view-grid--connection">
        <section className="con-col">
          <div>
            <div className="lit-kicker">{t('connection.kicker')}</div>
            <h2 className="con-title" style={{ color: c.fg }}>
              {c.title()}
            </h2>
            <p className="con-note">{c.note()}</p>
          </div>
          <dl className="con-dl">
            <dt className="text-muted">{t('connection.obsIp')}</dt>
            <dd>{obsIp ?? '—'}</dd>
            <dt className="text-muted">{t('connection.port')}</dt>
            <dd>{data?.port ?? '—'}</dd>
            <dt className="text-muted">{t('connection.latency')}</dt>
            <dd>{data?.rtt != null ? `${data.rtt} ms` : '—'}</dd>
            <dt className="text-muted">{t('connection.lastSent')}</dt>
            <dd>{lastSent}</dd>
          </dl>
        </section>
        <section className="con-col">
          <div className="con-addr">
            <div className="field">
              <label>{t('connection.thisComputer')}</label>
              <div className="con-ip">{data ? data.addresses.join(' · ') || '127.0.0.1' : '…'}</div>
            </div>
            <div className="field">
              <label htmlFor="con-port">{t('connection.port')}</label>
              <input
                id="con-port"
                className="input"
                inputMode="numeric"
                value={portValue}
                onChange={(e) => setPort(e.target.value.replace(/\D/g, '').slice(0, 5))}
              />
            </div>
          </div>
          <div className="con-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!data || applyPort.isPending || !/^\d{4,5}$/.test(portValue)}
              onClick={() => applyPort.mutate(Number(portValue))}
            >
              <ArrowsClockwiseIcon size={16} weight="duotone" aria-hidden />
              {t('connection.reconnect')}
            </button>
            <button type="button" className="btn btn-secondary" disabled={test.isPending} onClick={() => test.mutate()}>
              <PulseIcon size={16} weight="duotone" aria-hidden />
              {t('connection.test')}
            </button>
          </div>
          {portError && (
            <p className="con-error" role="alert">
              {t('connection.portError', { message: portError })}
            </p>
          )}
          <p className="text-muted con-foot">{t('connection.foot')}</p>
          <div className="con-log">
            <h6 className="text-muted">{t('connection.log')}</h6>
            {data?.log.length === 0 && <p className="empty-note">{t('connection.log.empty')}</p>}
            {data?.log.map((e, i) => (
              <div key={`${e.time}:${i}`} className="con-log-row">
                <span className="text-muted">{hhmm(e.time)}</span>
                <span>{logText(e)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
      {data && <OutputsSection outputs={data.outputs} base={base} onSaved={refresh} />}
    </main>
  )
}

interface OutputState extends Output {
  status: 'online' | 'unstable' | 'offline'
}

function OutputsSection({ outputs, base, onSaved }: { outputs: OutputState[]; base: string; onSaved: () => void }) {
  const api = useApi()
  const collections = useQuery({ queryKey: ['collections'], queryFn: () => json(api.api.v1.library.collections.$get()) })
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [error, setError] = useState('')
  const plain: Output[] = outputs.map(({ slug, name, collections, style }) => ({ slug, name, collections, style }))
  const save = useMutation({
    mutationFn: async (next: Output[]) => {
      const res = await api.api.v1.connection.outputs.$put({ json: next })
      if (!res.ok) throw new Error(res.statusText)
    },
    onSuccess: () => {
      setEditing(null)
      setError('')
      onSaved()
    },
    onError: () => setError(t('outputs.saveError'))
  })
  const submit = (next: Output[]) => {
    const parsed = Outputs.safeParse(next)
    if (!parsed.success) return setError(t('outputs.invalid'))
    save.mutate(parsed.data)
  }
  const copy = (text: string) => void navigator.clipboard?.writeText(text)
  const label = (binding: string) => {
    if (binding.endsWith(':*')) return kindLabel(binding.slice(0, -2))
    const [kind, id = 'creeds'] = binding.split(':')
    return collections.data?.find((x) => x.kind === kind && x.id === id)?.title ?? binding
  }

  return (
    <section className="con-outputs" aria-label={t('outputs.title')}>
      <h6 className="text-muted">{t('outputs.title')}</h6>
      <p className="text-muted con-foot">{t('outputs.hint')}</p>
      {outputs.map((o, i) =>
        editing === i ? (
          <OutputEditor
            key={o.slug}
            initial={plain[i]}
            others={plain.filter((_, j) => j !== i)}
            collections={collections.data ?? []}
            saving={save.isPending}
            onCancel={() => setEditing(null)}
            onSave={(edited) => submit(plain.map((x, j) => (j === i ? edited : x)))}
          />
        ) : (
          <article key={o.slug} className="con-output" aria-label={o.name}>
            <div className="con-output-head">
              <span className="status-dot" style={{ background: CONN_VIEW[o.status].dot }} />
              <span className="con-output-name">{o.name}</span>
              <span className="text-muted">/{o.slug}</span>
              <span className="text-muted con-output-state">{CONN_VIEW[o.status].label()}</span>
            </div>
            {[`${base}/overlay/${o.slug}`, `${base}/overlay/resources/${o.slug}`].map((url) => (
              <div key={url} className="con-url">
                <code>{url}</code>
                <button type="button" className="btn btn-ghost btn-icon" title={t('outputs.copy')} aria-label={t('outputs.copyUrl', { url })} onClick={() => copy(url)}>
                  <CopyIcon size={16} weight="duotone" />
                </button>
              </div>
            ))}
            <div className="text-muted con-output-cols">{o.collections.map(label).join(' · ') || t('outputs.noCollections')}</div>
            <div className="con-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(i)}>
                {t('outputs.edit')}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => window.confirm(t('outputs.confirmRemove', { name: o.name })) && submit(plain.filter((_, j) => j !== i))}
              >
                {t('outputs.remove')}
              </button>
            </div>
          </article>
        )
      )}
      {editing === 'new' ? (
        <OutputEditor
          initial={{ slug: '', name: '', collections: [], style: DEFAULT_STYLE }}
          others={plain}
          collections={collections.data ?? []}
          saving={save.isPending}
          onCancel={() => setEditing(null)}
          onSave={(created) => submit([...plain, created])}
        />
      ) : (
        <div className="con-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setEditing('new')}>
            <PlusIcon size={16} weight="duotone" aria-hidden />
            {t('outputs.new')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => window.confirm(t('outputs.confirmDefaults')) && submit([...DEFAULT_OUTPUTS])}>
            {t('outputs.restoreDefaults')}
          </button>
        </div>
      )}
      {error && (
        <p className="con-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
