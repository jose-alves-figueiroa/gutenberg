/**
 * Band lists and sermons (PLAN.md → E18), kept in the `settings` table as JSON: the lists are data
 * the operator edits in the Library (defaults from design v2), the sermon belongs to each service.
 */
import { BandLibrary, DEFAULT_BANDS, Sermon } from '../../shared/bands'
import { SETTINGS } from '../db/build'
import type { SqlDatabase } from '../db/schema'
import { saveSetting } from './repository'

const read = (db: SqlDatabase, key: string): unknown => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  try {
    return row ? JSON.parse(row.value) : undefined
  } catch {
    return undefined
  }
}

export function bands(db: SqlDatabase): BandLibrary {
  const parsed = BandLibrary.safeParse(read(db, SETTINGS.bands))
  return parsed.success ? parsed.data : DEFAULT_BANDS
}

export function saveBands(db: SqlDatabase, library: BandLibrary): BandLibrary {
  saveSetting(db, SETTINGS.bands, JSON.stringify(library))
  return library
}

const EMPTY_SERMON: Sermon = { preacher: '', title: '', text: '' }

function sermons(db: SqlDatabase): Record<string, Sermon> {
  const all = read(db, SETTINGS.sermons)
  return all && typeof all === 'object' ? (all as Record<string, Sermon>) : {}
}

export function sermon(db: SqlDatabase, serviceId: number): Sermon {
  const parsed = Sermon.safeParse(sermons(db)[String(serviceId)])
  return parsed.success ? parsed.data : EMPTY_SERMON
}

export function saveSermon(db: SqlDatabase, serviceId: number, value: Sermon): Sermon {
  saveSetting(db, SETTINGS.sermons, JSON.stringify({ ...sermons(db), [String(serviceId)]: value }))
  return value
}
