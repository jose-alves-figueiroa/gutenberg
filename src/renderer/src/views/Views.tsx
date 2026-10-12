import type { ReactNode } from 'react'
import { t } from '@shared/i18n'
import { tabLabel, type TabId } from '../tabs'

export { LibraryView } from './library/LibraryView'

function View({ id, children }: { id: TabId; children: ReactNode }) {
  return (
    <main className="view" role="tabpanel" id={`view-${id}`} aria-labelledby={`tab-${id}`}>
      <div className={`view-grid view-grid--${id}`}>{children}</div>
    </main>
  )
}

/** Kicker + h2 + empty-state note shared by the placeholder views. */
function Heading({ id, note }: { id: TabId; note: string }) {
  return (
    <>
      <h6 className="kicker">{tabLabel(id)}</h6>
      <h2>{tabLabel(id)}</h2>
      <p className="empty-note">{note}</p>
    </>
  )
}

export function LiturgyView() {
  return (
    <View id="liturgy">
      <aside>
        <h6 className="text-muted">{t('liturgy.aside')}</h6>
      </aside>
      <section className="view-main">
        <Heading id="liturgy" note={t('liturgy.empty')} />
      </section>
    </View>
  )
}

export function PresentView() {
  return (
    <View id="present">
      <aside>
        <h6 className="text-muted">{t('present.aside')}</h6>
      </aside>
      <section>
        <Heading id="present" note={t('present.empty')} />
      </section>
    </View>
  )
}

export function ConnectionView() {
  return (
    <View id="connection">
      <section>
        <Heading id="connection" note={t('connection.empty')} />
      </section>
    </View>
  )
}
