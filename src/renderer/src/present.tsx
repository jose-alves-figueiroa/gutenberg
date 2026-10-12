/**
 * The presentation as the main process keeps it (`/api/v1/present`): the sequence of items, the
 * screen on the air and the commands that change it.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PresentCommand } from '@shared/presentation'
import { json, useApi } from './api'
import { useNavigate } from './navigation'

/** Sends commands; the answer (the new view) replaces the cached one. */
export function usePresentCommand() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (cmd: PresentCommand) => json(api.api.v1.present.command.$post({ json: cmd })),
    onSuccess: (v) => qc.setQueryData(['present'], v)
  })
}

export function usePresent() {
  const api = useApi()
  // Always fresh: the liturgy or the library may have changed since the last visit.
  const view = useQuery({ queryKey: ['present'], staleTime: 0, queryFn: () => json(api.api.v1.present.$get()) })
  const command = usePresentCommand()
  return { view: view.data, command: command.mutate }
}

/** Runs a command (e.g. an ad hoc item, "Apresentar este culto") and opens the Present tab. */
export function usePresentAndOpen() {
  const command = usePresentCommand()
  const navigate = useNavigate()
  return {
    run: async (cmd: PresentCommand) => {
      await command.mutateAsync(cmd)
      navigate('present')
    },
    pending: command.isPending
  }
}
