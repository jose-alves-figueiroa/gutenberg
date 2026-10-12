/**
 * Renderer access to the local HTTP API: a typed Hono client (route types come from the server)
 * plus TanStack Query for caching, loading states and invalidation after saves.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { hc, parseResponse } from 'hono/client'
import { createContext, useContext, useState, type ReactNode } from 'react'
import type { AppType } from '../../main/server/app'

declare global {
  interface Window {
    gutenberg?: { version: string; serverUrl: string }
  }
}

export type ApiClient = ReturnType<typeof hc<AppType>>

export function createApiClient(baseUrl: string, fetchImpl?: typeof fetch): ApiClient {
  return hc<AppType>(baseUrl, fetchImpl ? { fetch: fetchImpl } : undefined)
}

const ApiContext = createContext<ApiClient | null>(null)

/** Provides the API client (defaults to the server URL given by the preload) and a QueryClient. */
export function ApiProvider({ client, queryClient, children }: { client?: ApiClient; queryClient?: QueryClient; children: ReactNode }) {
  const [api] = useState(() => client ?? createApiClient(window.gutenberg?.serverUrl ?? ''))
  const [qc] = useState(() => queryClient ?? new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }))
  return (
    <ApiContext.Provider value={api}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </ApiContext.Provider>
  )
}

export function useApi(): ApiClient {
  const api = useContext(ApiContext)
  if (!api) throw new Error('ApiProvider missing')
  return api
}

/** Unwraps a Hono client response: typed success body, or a thrown error (TanStack Query shows it). */
export const json = parseResponse
