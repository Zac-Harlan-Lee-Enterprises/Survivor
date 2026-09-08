import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ServicesProvider } from '@/app/services'
import { AppRouter } from '@/app/router'
import { getConfig } from '@/config/env'
import { createServices } from '@/data'
import './styles/index.css'

const config = getConfig()
const services = createServices(config)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true },
  },
})

async function boot() {
  // Completes an OIDC redirect (connected mode) before the router mounts so
  // the ?code= query never leaks into app state. No-op in demo mode.
  await services.auth.handleCallback().catch((err: unknown) => {
    console.error('Auth callback failed', err)
  })
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ServicesProvider services={services}>
          <AppRouter />
        </ServicesProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}

void boot()
