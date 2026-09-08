import type { Actor, AuthService, Session } from '../interfaces'
import type { DemoStore } from './store'

/**
 * Demo sign-in: pick any league member from a list. There is no password and
 * no security here on purpose — it is a showcase of the UI. Connected mode
 * uses Cognito (Authorization Code + PKCE) and the API checks every role.
 */
export function createDemoAuth(store: DemoStore): AuthService {
  const listeners = new Set<(s: Session | null) => void>()

  const actors = (): Actor[] => {
    const snap = store.snapshot()
    return snap.memberships
      .filter((m) => m.status === 'active')
      .map((m) => {
        const profile = snap.profiles.find((p) => p.playerId === m.playerId)
        return {
          playerId: m.playerId,
          displayName: profile?.displayName ?? m.playerId,
          isCommissioner: m.role === 'commissioner',
        }
      })
  }

  const getSession = (): Session | null => {
    const id = store.get().sessionPlayerId
    if (!id) return null
    const actor = actors().find((a) => a.playerId === id)
    return actor ? { actor } : null
  }

  const emit = () => {
    const s = getSession()
    for (const l of listeners) l(s)
  }
  store.subscribe(emit)

  return {
    kind: 'demo',
    getSession,
    async signIn(options) {
      const id = options?.asPlayerId ?? actors()[0]?.playerId ?? null
      store.update((d) => {
        d.sessionPlayerId = id
      })
    },
    async signOut() {
      store.update((d) => {
        d.sessionPlayerId = null
      })
    },
    async handleCallback() {
      return false
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async listDemoIdentities() {
      return actors()
    },
  }
}
