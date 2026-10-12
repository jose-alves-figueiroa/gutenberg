/** Services ("cultos") and their liturgy items (schema: services, liturgy_items). */
import type { SqlDatabase } from '../db/schema'
import { resolveItem } from '../library/items'
import { NotFoundError } from '../library/repository'

export interface ServiceSummary {
  id: number
  name: string
  count: number
}

export interface LiturgyItem {
  position: number
  moment: string
  collection: string
  itemRef: string
  title: string
  collectionLabel: string
  screens: number
  missing: boolean
}

export interface ServiceDetail {
  id: number
  name: string
  items: LiturgyItem[]
}

export function services(db: SqlDatabase): ServiceSummary[] {
  return db
    .prepare('SELECT s.id, s.name, (SELECT count(*) FROM liturgy_items i WHERE i.service_id = s.id) AS count FROM services s ORDER BY s.id')
    .all() as unknown as ServiceSummary[]
}

function assertService(db: SqlDatabase, id: number): void {
  if (!db.prepare('SELECT 1 FROM services WHERE id = ?').get(id)) throw new NotFoundError(`unknown service ${id}`)
}

export function createService(db: SqlDatabase, name: string): ServiceSummary {
  const r = db.prepare('INSERT INTO services (name) VALUES (?)').run(name) as { lastInsertRowid: number | bigint }
  return { id: Number(r.lastInsertRowid), name, count: 0 }
}

export function renameService(db: SqlDatabase, id: number, name: string): void {
  assertService(db, id)
  db.prepare('UPDATE services SET name = ? WHERE id = ?').run(name, id)
}

export function deleteService(db: SqlDatabase, id: number): void {
  assertService(db, id)
  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM liturgy_items WHERE service_id = ?').run(id)
    db.prepare('DELETE FROM services WHERE id = ?').run(id)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

export function service(db: SqlDatabase, id: number, max: number): ServiceDetail {
  const s = db.prepare('SELECT id, name FROM services WHERE id = ?').get(id) as { id: number; name: string } | undefined
  if (!s) throw new NotFoundError(`unknown service ${id}`)
  const rows = db
    .prepare('SELECT position, moment, collection, item_ref FROM liturgy_items WHERE service_id = ? ORDER BY position')
    .all(id) as { position: number; moment: string; collection: string; item_ref: string }[]
  const items = rows.map((r) => {
    const resolved = resolveItem(db, r.collection, r.item_ref, max)
    return {
      position: r.position,
      moment: r.moment,
      collection: r.collection,
      itemRef: r.item_ref,
      title: resolved.title,
      collectionLabel: resolved.collectionLabel,
      screens: resolved.slides.length,
      missing: resolved.missing
    }
  })
  return { id: s.id, name: s.name, items }
}

export function addItem(db: SqlDatabase, serviceId: number, item: { collection: string; itemRef: string; moment: string }): number {
  assertService(db, serviceId)
  const last = db.prepare('SELECT max(position) AS p FROM liturgy_items WHERE service_id = ?').get(serviceId) as { p: number | null }
  const position = (last.p ?? 0) + 1
  db.prepare('INSERT INTO liturgy_items (service_id, position, moment, collection, item_ref) VALUES (?, ?, ?, ?, ?)').run(
    serviceId,
    position,
    item.moment,
    item.collection,
    item.itemRef
  )
  return position
}

function assertItem(db: SqlDatabase, serviceId: number, position: number): void {
  if (!db.prepare('SELECT 1 FROM liturgy_items WHERE service_id = ? AND position = ?').get(serviceId, position))
    throw new NotFoundError(`unknown item ${serviceId}/${position}`)
}

export function setMoment(db: SqlDatabase, serviceId: number, position: number, moment: string): void {
  assertItem(db, serviceId, position)
  db.prepare('UPDATE liturgy_items SET moment = ? WHERE service_id = ? AND position = ?').run(moment, serviceId, position)
}

/** Swaps an item with its neighbour; a move past either end is a no-op. */
export function moveItem(db: SqlDatabase, serviceId: number, position: number, delta: -1 | 1): void {
  assertItem(db, serviceId, position)
  const other = position + delta
  if (!db.prepare('SELECT 1 FROM liturgy_items WHERE service_id = ? AND position = ?').get(serviceId, other)) return
  db.exec('BEGIN')
  try {
    const set = db.prepare('UPDATE liturgy_items SET position = ? WHERE service_id = ? AND position = ?')
    set.run(-1, serviceId, position)
    set.run(position, serviceId, other)
    set.run(other, serviceId, -1)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

/** Removes an item and closes the gap, keeping positions 1..n. */
export function removeItem(db: SqlDatabase, serviceId: number, position: number): void {
  assertItem(db, serviceId, position)
  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM liturgy_items WHERE service_id = ? AND position = ?').run(serviceId, position)
    const later = db
      .prepare('SELECT position FROM liturgy_items WHERE service_id = ? AND position > ? ORDER BY position')
      .all(serviceId, position) as { position: number }[]
    const set = db.prepare('UPDATE liturgy_items SET position = ? WHERE service_id = ? AND position = ?')
    for (const r of later) set.run(r.position - 1, serviceId, r.position)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
