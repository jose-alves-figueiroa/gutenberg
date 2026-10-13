/** App updates as the main process sees them (`/api/v1/update`, PLAN.md → E10). */
import { useQuery } from '@tanstack/react-query'
import { json, useApi } from './api'

/** Fast while something is moving (checking, downloading), slow otherwise. */
export const UPDATE_REFRESH_MS = { busy: 1_000, idle: 60_000 }

export function useUpdate() {
  const api = useApi()
  return useQuery({
    queryKey: ['update'],
    queryFn: () => json(api.api.v1.update.$get()),
    refetchInterval: (q) => (q.state.data?.status === 'checking' || q.state.data?.status === 'downloading' ? UPDATE_REFRESH_MS.busy : UPDATE_REFRESH_MS.idle)
  })
}
