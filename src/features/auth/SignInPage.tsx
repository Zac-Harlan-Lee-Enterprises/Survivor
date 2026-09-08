import { useLocation, useNavigate } from 'react-router'
import { Crown } from 'lucide-react'
import { useServices } from '@/app/hooks'
import { useDemoIdentities } from '@/app/queries'
import { useLeagueContext } from '@/app/hooks'
import { Headshot } from '@/components/Headshot'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/states'

export function SignInPage() {
  const { auth, mode } = useServices()
  const navigate = useNavigate()
  const location = useLocation()
  const { profileOf } = useLeagueContext()
  const identities = useDemoIdentities()
  const from = (location.state as { from?: string } | null)?.from ?? '/me'

  if (mode === 'connected') {
    return (
      <div className="card mx-auto my-12 max-w-md p-8 text-center">
        <p className="eyebrow">Members only</p>
        <h1 className="mt-2 text-4xl font-extrabold text-ink-50">Sign in</h1>
        <p className="mt-2 text-ink-300">
          You’ll be sent to the league’s secure sign-in page and brought right back.
        </p>
        <Button className="mt-6" size="lg" onClick={() => void auth.signIn()}>
          Continue to sign in
        </Button>
      </div>
    )
  }

  if (identities.isLoading) return <LoadingState label="Loading identities" />

  return (
    <div className="mx-auto max-w-3xl">
      <p className="eyebrow">Demo sign-in</p>
      <h1 className="mt-1 text-4xl font-extrabold text-ink-50">Who are you today?</h1>
      <p className="mt-2 max-w-prose text-ink-300">
        Demo mode has no passwords: pick any league member to see the app through their eyes. The
        commissioner unlocks the admin tools.
      </p>
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {(identities.data ?? []).map((actor) => {
          const profile = profileOf(actor.playerId)
          return (
            <li key={actor.playerId}>
              <button
                type="button"
                className="card flex w-full flex-col items-center gap-2 p-4 text-center transition hover:-translate-y-0.5 hover:border-gold-400/50 focus-visible:ring-2 focus-visible:ring-sky-400"
                onClick={async () => {
                  await auth.signIn({ asPlayerId: actor.playerId })
                  navigate(from, { replace: true })
                }}
              >
                <Headshot name={actor.displayName} playerId={profile.playerId} size="md" />
                <span className="font-display text-base font-bold uppercase text-ink-50">
                  {actor.displayName}
                </span>
                {actor.isCommissioner && (
                  <span className="inline-flex items-center gap-1 text-xs text-gold-300">
                    <Crown className="h-3 w-3" aria-hidden="true" /> Commissioner
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
