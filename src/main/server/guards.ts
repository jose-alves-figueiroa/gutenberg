/** Request origin helpers shared by the route modules. */
import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context, MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

/** Remote address of the request, or '' when unknown. */
export function remoteIp(c: Context): string {
  try {
    return getConnInfo(c).remote.address ?? ''
  } catch {
    return ''
  }
}

/** Rejects requests that do not come from this computer (the operator UI). */
export const localOnly: MiddlewareHandler = async (c, next) => {
  if (!LOOPBACK.has(remoteIp(c))) throw new HTTPException(403, { message: 'local only' })
  await next()
}
