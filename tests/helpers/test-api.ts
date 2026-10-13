/** In-process API for UI tests: seed database + Hono server + typed client, no port opened. */
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { QueryClient } from '@tanstack/react-query'
import { fillDatabase } from '../../src/main/db/build'
import { migrate } from '../../src/main/db/schema'
import { createServerApp, type ServerOptions } from '../../src/main/server/app'
import { createApiClient } from '../../src/renderer/src/api'
import { loadCanonical } from '../../scripts/lib/canonical'

const SEED = join(__dirname, '..', 'fixtures', 'canonical')
const LOCAL = { incoming: { socket: { remoteAddress: '127.0.0.1' } } }

export function createTestApi(options: ServerOptions = {}) {
  const db = new DatabaseSync(':memory:')
  migrate(db)
  fillDatabase(db, loadCanonical(SEED).data)
  const app = createServerApp(db, options)
  const client = createApiClient('http://127.0.0.1', ((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(app.request(input instanceof Request ? input : String(input), init, LOCAL))) as typeof fetch)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return { db, app, client, queryClient }
}
