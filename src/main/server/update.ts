/** Local routes of the updates (PLAN.md → US10.3): state, "Verificar atualizações", "Reiniciar e atualizar". */
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { UpdateService } from '../update/service'
import { localOnly } from './guards'

export function updateRoutes(updates: UpdateService) {
  return new Hono()
    .use(localOnly)
    .get('/', (c) => c.json(updates.state()))
    .post('/check', async (c) => c.json(await updates.check()))
    .post('/install', (c) => {
      if (!updates.install()) throw new HTTPException(409, { message: 'no update ready' })
      return c.json({ ok: true })
    })
}
