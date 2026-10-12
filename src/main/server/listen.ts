/** Starts the HTTP server on the LAN (all interfaces), so OBS on another computer can reach it. */
import { serve, type ServerType } from '@hono/node-server'
import type { Hono } from 'hono'

export const DEFAULT_HTTP_PORT = 8484

export function startHttpServer(app: Hono, port: number, hostname = '0.0.0.0'): Promise<ServerType> {
  return new Promise((resolve, reject) => {
    const server = serve({ fetch: app.fetch, port, hostname }, () => resolve(server))
    server.once('error', reject)
  })
}
