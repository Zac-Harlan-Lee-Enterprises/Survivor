import { Navigate, useLocation } from 'react-router'
import type { ReactNode } from 'react'
import { useSession } from './hooks'

export function RequireAuth({
  children,
  commissioner = false,
}: {
  children: ReactNode
  commissioner?: boolean
}) {
  const session = useSession()
  const location = useLocation()
  if (!session) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
  if (commissioner && !session.actor.isCommissioner) return <Navigate to="/" replace />
  return <>{children}</>
}
