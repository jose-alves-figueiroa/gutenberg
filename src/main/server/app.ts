/**
 * Gutenberg's HTTP API (PLAN.md → "Stack e protocolo"). One Hono app, two kinds of routes:
 * - public on the LAN, for OBS (overlay, current screen, events, health) — E7;
 * - local only (`127.0.0.1` / `::1`): the library, liturgies and presentation commands.
 */
import { getConnInfo } from '@hono/node-server/conninfo'
import { zValidator } from '@hono/zod-validator'
import { Hono, type MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import {
  CatechismQuestionBody,
  ConfessionSectionBody,
  CreedBody,
  LibraryParams as P,
  SongBody
} from '../../shared/library-schemas'
import type { SqlDatabase } from '../db/schema'
import * as repo from '../library/repository'

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

export function createServerApp(db: SqlDatabase) {
  return new Hono()
    .onError((err, c) => {
      if (err instanceof HTTPException) return c.json({ error: err.message }, err.status)
      if (err instanceof repo.NotFoundError) return c.json({ error: err.message }, 404)
      console.error(err)
      return c.json({ error: 'internal error' }, 500)
    })
    .route('/api/v1/library', libraryRoutes(db))
}

/** Route types for the renderer's typed client (`hono/client`). */
export type AppType = ReturnType<typeof createServerApp>
