/**
 * The current service ("culto"), shared by every tab: the Liturgy edits it, the Library adds items
 * to it ("Adicionar à liturgia") and Present (E6) shows it.
 */
import { useQuery } from '@tanstack/react-query'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { json, useApi } from './api'

export interface ServiceSummary {
  id: number
  name: string
  count: number
}

interface ServiceState {
  services: ServiceSummary[] | undefined
  current: ServiceSummary | null
  select: (id: number | null) => void
}

const ServiceContext = createContext<ServiceState | null>(null)

export function ServiceProvider({ children }: { children: ReactNode }) {
  const api = useApi()
  const services = useQuery({ queryKey: ['services'], queryFn: () => json(api.api.v1.liturgy.services.$get()) })
  const [selected, setSelected] = useState<number | null>(null)
  // The selected service, or the first one when none (or a deleted one) is selected.
  const current = services.data?.find((s) => s.id === selected) ?? services.data?.[0] ?? null
  return <ServiceContext.Provider value={{ services: services.data, current, select: setSelected }}>{children}</ServiceContext.Provider>
}

export function useServices(): ServiceState {
  const ctx = useContext(ServiceContext)
  if (!ctx) throw new Error('ServiceProvider missing')
  return ctx
}
