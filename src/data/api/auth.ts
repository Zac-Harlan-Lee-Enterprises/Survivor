import { z } from 'zod'
import type { Actor, AuthService, Session } from '../interfaces'
import type { HttpClient } from './http'

/**
 * OIDC (Cognito Hosted UI) with Authorization Code + PKCE. The library is
 * loaded lazily so demo builds never ship it. Redirects land on the app's base
 * URL (no hash) — the 404.html shim keeps any deep link intact on GitHub Pages
 * and HashRouter takes over after the callback is consumed.
 */

export interface OidcOptions {
  authority: string
  clientId: string
  /** e.g. https://owner.github.io/Survivor/ */
  redirectUri: string
  http: HttpClient
}

const MeSchema = z.object({
  playerId: z.string(),
  displayName: z.string(),
  isCommissioner: z.boolean(),
})

type UserManagerLike = {
  getUser(): Promise<{ access_token: string; expires_at?: number; expired?: boolean } | null>
  signinRedirect(args?: { state?: unknown }): Promise<void>
  signinCallback(): Promise<unknown>
  signoutRedirect(): Promise<void>
  removeUser(): Promise<void>
  events: { addUserLoaded(cb: () => void): void; addUserUnloaded(cb: () => void): void }
}

export function createOidcAuth(
  options: OidcOptions,
): AuthService & { getAccessToken(): Promise<string | null> } {
  let manager: UserManagerLike | null = null
  let session: Session | null = null
  const listeners = new Set<(s: Session | null) => void>()
  const emit = () => {
    for (const l of listeners) l(session)
  }

  const getManager = async (): Promise<UserManagerLike> => {
    if (manager) return manager
    const oidc = await import('oidc-client-ts')
    manager = new oidc.UserManager({
      authority: options.authority,
      client_id: options.clientId,
      redirect_uri: options.redirectUri,
      post_logout_redirect_uri: options.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      automaticSilentRenew: true,
      userStore: new oidc.WebStorageStateStore({ store: window.localStorage }),
    }) as unknown as UserManagerLike
    manager.events.addUserLoaded(() => void refreshSession())
    manager.events.addUserUnloaded(() => {
      session = null
      emit()
    })
    return manager
  }

  const getAccessToken = async (): Promise<string | null> => {
    const m = await getManager()
    const user = await m.getUser()
    if (!user || user.expired) return null
    return user.access_token
  }

  const refreshSession = async (): Promise<void> => {
    const token = await getAccessToken()
    if (!token) {
      session = null
      emit()
      return
    }
    const me = await options.http.request('/me', { schema: MeSchema })
    const actor: Actor = {
      playerId: me.playerId,
      displayName: me.displayName,
      isCommissioner: me.isCommissioner,
    }
    session = { actor }
    emit()
  }

  return {
    kind: 'oidc',
    getSession: () => session,
    getAccessToken,
    async signIn() {
      const m = await getManager()
      await m.signinRedirect({ state: { returnTo: window.location.hash } })
    },
    async signOut() {
      const m = await getManager()
      await m.signoutRedirect()
    },
    async handleCallback() {
      const params = new URLSearchParams(window.location.search)
      if (params.has('code') && params.has('state')) {
        const m = await getManager()
        const result = (await m.signinCallback()) as { state?: { returnTo?: string } } | undefined
        const returnTo = result?.state?.returnTo ?? ''
        window.history.replaceState({}, '', `${window.location.pathname}${returnTo}`)
        await refreshSession()
        return true
      }
      // Restore an existing session on ordinary loads.
      await refreshSession().catch(() => {
        session = null
        emit()
      })
      return false
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
