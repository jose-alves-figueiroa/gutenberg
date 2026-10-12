/** Connection with OBS as the main process sees it (`/api/v1/connection`), refreshed every second. */
import { useQuery } from '@tanstack/react-query'
import { json, useApi } from './api'

export const CONNECTION_REFRESH_MS = 1_000

export function useConnection() {
  const api = useApi()
  return useQuery({
    queryKey: ['connection'],
    refetchInterval: CONNECTION_REFRESH_MS,
    staleTime: 0,
    queryFn: () => json(api.api.v1.connection.$get())
  })
}
