/**
 * The overlay page in preview mode (`/overlay?preview`), fed a payload by postMessage: the same
 * drawing OBS shows (output editor, band lists). 16:9, as wide as its container.
 */
import { useEffect, useRef, useState } from 'react'
import { t } from '@shared/i18n'
import type { Payload } from '@shared/payload'
import { useApi } from '../api'

export function OverlayPreview({ payload, title = t('outputs.previewFrame') }: { payload: Payload; title?: string }) {
  const api = useApi()
  const frame = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const src = `${new URL(api.overlay.$url().toString()).origin}/overlay?preview`
  const message = JSON.stringify(payload)
  useEffect(() => {
    if (ready) frame.current?.contentWindow?.postMessage(JSON.parse(message), '*')
  }, [ready, message])
  return <iframe ref={frame} className="out-preview" title={title} src={src} onLoad={() => setReady(true)} />
}
