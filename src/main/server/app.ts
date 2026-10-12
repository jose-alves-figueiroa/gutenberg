/**
 * Gutenberg's HTTP API (PLAN.md → "Stack e protocolo"). One Hono app, two kinds of routes:
 * - public on the LAN, for OBS (overlay, current screen, events, health) — E7;
 * - local only (`127.0.0.1` / `::1`): the library, liturgies and presentation commands (`/present`).
 */
import { getConnInfo } from '@hono/node-server/conninfo'
import { zValidator } from '@hono/zod-validator'
import { Hono, type Context, type MiddlewareHandler } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import { HTTPException } from 'hono/http-exception'
import {
  CatechismQuestionBody,
  ConfessionSectionBody,
  CreedBody,
  LibraryParams as P,
  LiturgySchemas as L,
  SongBody
} from '../../shared/library-schemas'
import type { SqlDatabase } from '../db/schema'
import { resolveItem, searchCollection } from '../library/items'
import * as repo from '../library/repository'
import * as liturgy from '../liturgy/repository'
import { createPresenter, type Presenter } from '../present/presenter'
import { overlayHtml } from './overlay'
import { PresentCommand } from '../../shared/presentation'

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

/** Rejects requests that do not come from this computer (the operator UI). */
export const localOnly: MiddlewareHandler = async (c, next) => {
  let address: string | undefined
  try {
    address = getConnInfo(c).remote.address
  } catch {
    address = undefined
  }
  if (!address || !LOOPBACK.has(address)) throw new HTTPException(403, { message: 'local only' })
  await next()
}

function libraryRoutes(db: SqlDatabase) {
  const orNotFound = <T>(value: T | null): T => {
    if (value === null) throw new HTTPException(404, { message: 'not found' })
    return value
  }
  return new Hono()
    .use(localOnly)
    .get('/collections', (c) => c.json(repo.collections(db)))
    .get('/settings', (c) => c.json(repo.settings(db)))
    .get('/search', zValidator('query', L.searchQuery), (c) => {
      const { collection, q } = c.req.valid('query')
      return c.json(searchCollection(db, collection, q))
    })
    .get('/resolve', zValidator('query', L.resolveQuery), (c) => {
      const { collection, itemRef } = c.req.valid('query')
      return c.json(resolveItem(db, collection, itemRef, repo.settings(db).screenCharLimit))
    })
    .get('/bible/:version/books', zValidator('param', P.version), (c) => c.json(repo.bibleBooks(db, c.req.valid('param').version)))
    .get('/bible/:version/:book/:chapter', zValidator('param', P.chapter), (c) => {
      const { version, book, chapter } = c.req.valid('param')
      return c.json(repo.bibleChapter(db, version, book, chapter))
    })
    .get('/confessions/:id/chapters', zValidator('param', P.doc), (c) => c.json(repo.confessionChapters(db, c.req.valid('param').id)))
    .get('/confessions/:id/:chapter/:section', zValidator('param', P.section), (c) => {
      const { id, chapter, section } = c.req.valid('param')
      return c.json(orNotFound(repo.confessionSection(db, id, chapter, section)))
    })
    .put('/confessions/:id/:chapter/:section', zValidator('param', P.section), zValidator('json', ConfessionSectionBody), (c) => {
      const { id, chapter, section } = c.req.valid('param')
      repo.saveConfessionSection(db, { confessionId: id, chapter, section, ...c.req.valid('json') })
      return c.json({ ok: true })
    })
    .get('/catechisms/:id', zValidator('param', P.doc), (c) => c.json(repo.catechism(db, c.req.valid('param').id)))
    .get('/catechisms/:id/:number', zValidator('param', P.question), (c) => {
      const { id, number } = c.req.valid('param')
      return c.json(orNotFound(repo.catechismQuestion(db, id, number)))
    })
    .put('/catechisms/:id/:number', zValidator('param', P.question), zValidator('json', CatechismQuestionBody), (c) => {
      const { id, number } = c.req.valid('param')
      repo.saveCatechismQuestion(db, { catechismId: id, number, ...c.req.valid('json') })
      return c.json({ ok: true })
    })
    .get('/songbooks/:id', zValidator('param', P.doc), (c) => c.json(repo.songbook(db, c.req.valid('param').id)))
    .get('/songs/:id', zValidator('param', P.song), (c) => c.json(orNotFound(repo.song(db, c.req.valid('param').id))))
    .put('/songs', zValidator('json', SongBody), (c) => c.json(repo.saveSong(db, c.req.valid('json'))))
    .get('/creeds', (c) => c.json(repo.creeds(db)))
    .put('/creeds/:id', zValidator('param', P.creed), zValidator('json', CreedBody), (c) => {
      repo.saveCreed(db, { id: c.req.valid('param').id, ...c.req.valid('json') })
      return c.json({ ok: true })
    })
}

function liturgyRoutes(db: SqlDatabase) {
  const max = () => repo.settings(db).screenCharLimit
  return new Hono()
    .use(localOnly)
    .get('/services', (c) => c.json(liturgy.services(db)))
    .post('/services', zValidator('json', L.serviceBody), (c) => c.json(liturgy.createService(db, c.req.valid('json').name), 201))
    .get('/services/:id', zValidator('param', L.serviceParam), (c) => c.json(liturgy.service(db, c.req.valid('param').id, max())))
    .patch('/services/:id', zValidator('param', L.serviceParam), zValidator('json', L.serviceBody), (c) => {
      liturgy.renameService(db, c.req.valid('param').id, c.req.valid('json').name)
      return c.json({ ok: true })
    })
    .delete('/services/:id', zValidator('param', L.serviceParam), (c) => {
      liturgy.deleteService(db, c.req.valid('param').id)
      return c.json({ ok: true })
    })
    .post('/services/:id/items', zValidator('param', L.serviceParam), zValidator('json', L.itemBody), (c) => {
      const position = liturgy.addItem(db, c.req.valid('param').id, c.req.valid('json'))
      return c.json({ position }, 201)
    })
    .patch('/services/:id/items/:position', zValidator('param', L.itemParam), zValidator('json', L.momentBody), (c) => {
      const { id, position } = c.req.valid('param')
      liturgy.setMoment(db, id, position, c.req.valid('json').moment)
      return c.json({ ok: true })
    })
    .post('/services/:id/items/:position/move', zValidator('param', L.itemParam), zValidator('json', L.moveBody), (c) => {
      const { id, position } = c.req.valid('param')
      liturgy.moveItem(db, id, position, c.req.valid('json').delta)
      return c.json({ ok: true })
    })
    .delete('/services/:id/items/:position', zValidator('param', L.itemParam), (c) => {
      const { id, position } = c.req.valid('param')
      liturgy.removeItem(db, id, position)
      return c.json({ ok: true })
    })
}

/** Heartbeat on the SSE stream, so proxies and OBS keep the connection open. */
export const SSE_HEARTBEAT_MS = 15_000

/**
 * Public on the LAN (OBS), per output (PLAN.md → E7 → Saídas): `/overlay/<output>` (page),
 * `/overlay/resources/<output>` (JSON) and `/overlay/resources/<output>/events` (SSE); without an
 * output, everything. CORS per route, so the local routes never get it.
 */
function publicRoutes(presenter: Presenter) {
  const open = cors()
  const notFound = () => {
    throw new HTTPException(404, { message: 'unknown output' })
  }
  const current = (slug?: string) => presenter.payload(slug) ?? notFound()
  const page = (slug?: string) => {
    current(slug)
    return overlayHtml(slug ?? null)
  }
  const events = (c: Context, slug?: string) => {
    current(slug)
    return streamSSE(c, async (stream) => {
      const send = () => {
        const payload = presenter.payload(slug)
        return payload ? stream.writeSSE({ data: JSON.stringify(payload), id: String(payload.map.seq) }) : Promise.resolve()
      }
      const unsubscribe = presenter.subscribe(() => void send())
      stream.onAbort(unsubscribe)
      await send()
      while (!stream.aborted) {
        await stream.sleep(SSE_HEARTBEAT_MS)
        if (!stream.aborted) await stream.write(': ping\n\n')
      }
      unsubscribe()
    })
  }
  const json = (c: Context, slug?: string) => {
    c.header('Cache-Control', 'no-store')
    return c.json(current(slug))
  }
  return new Hono()
    .get('/overlay', (c) => c.html(page()))
    .get('/overlay/resources', open, (c) => json(c))
    .get('/overlay/resources/events', open, (c) => events(c))
    .get('/overlay/resources/:output', open, (c) => json(c, c.req.param('output')))
    .get('/overlay/resources/:output/events', open, (c) => events(c, c.req.param('output')))
    .get('/overlay/:output', (c) => c.html(page(c.req.param('output'))))
    .get('/api/v1/health', open, (c) => c.json({ ok: true, time: Date.now() }))
}

function presentRoutes(presenter: Presenter) {
  return new Hono()
    .use(localOnly)
    .get('/', (c) => c.json(presenter.view()))
    .post('/command', zValidator('json', PresentCommand), (c) => c.json(presenter.command(c.req.valid('json'))))
}

export function createServerApp(db: SqlDatabase, presenter: Presenter = createPresenter(db)) {
  // An edit may change the text on the air: OBS gets the screen again (same seq).
  const notifyAfterEdit: MiddlewareHandler = async (c, next) => {
    await next()
    if (c.req.method !== 'GET' && c.res.ok && presenter.subscriberCount() > 0) presenter.notify()
  }
  return new Hono()
    .onError((err, c) => {
      if (err instanceof HTTPException) return c.json({ error: err.message }, err.status)
      if (err instanceof repo.NotFoundError) return c.json({ error: err.message }, 404)
      console.error(err)
      return c.json({ error: 'internal error' }, 500)
    })
    .use('/api/v1/library/*', notifyAfterEdit)
    .use('/api/v1/liturgy/*', notifyAfterEdit)
    .route('/api/v1/library', libraryRoutes(db))
    .route('/api/v1/liturgy', liturgyRoutes(db))
    .route('/api/v1/present', presentRoutes(presenter))
    .route('/', publicRoutes(presenter))
}

/** Route types for the renderer's typed client (`hono/client`). */
export type AppType = ReturnType<typeof createServerApp>
