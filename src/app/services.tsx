import type { ReactNode } from 'react'
import type { Services } from '@/data'
import { ServicesContext } from './hooks'

export function ServicesProvider({
  services,
  children,
}: {
  services: Services
  children: ReactNode
}) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>
}
