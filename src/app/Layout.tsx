import {
  Crown,
  Grid3X3,
  Home,
  ListOrdered,
  LogIn,
  LogOut,
  ScrollText,
  Shield,
  Trophy,
  User,
  Zap,
} from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useEffect } from 'react'
import { useLeagueContext, useServices, useSession } from './hooks'
import { Button } from '@/components/ui/button'
import { Headshot } from '@/components/Headshot'
import { cn } from '@/lib/cn'
import { getConfig } from '@/config/env'

const ALL_NAV = [
  { to: '/', label: 'League', icon: Home, end: true, write: false },
  { to: '/pick', label: 'Pick', icon: Zap, write: true },
  { to: '/leaderboard', label: 'Board', icon: Trophy, write: false },
  { to: '/grid', label: 'Grid', icon: Grid3X3, write: false },
  { to: '/rules', label: 'Rules', icon: ScrollText, write: false },
  { to: '/me', label: 'Me', icon: User, write: true },
]

export function Layout() {
  const { league, evaluation, viewer, profileOf } = useLeagueContext()
  const services = useServices()
  const session = useSession()
  const location = useLocation()
  // On a published demo build nobody's pick can reach anyone else, so every
  // write affordance is hidden rather than offered and quietly ignored.
  const { readOnly } = getConfig()
  const NAV = ALL_NAV.filter((item) => !item.write || !readOnly)

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  const me = session ? profileOf(session.actor.playerId) : null

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only-focusable fixed top-2 left-2 z-50 rounded-lg bg-gold-400 px-3 py-2 font-bold text-pitch-950"
      >
        Skip to content
      </a>
      {services.mode === 'demo' && !readOnly && <DemoBanner />}
      <header className="sticky top-0 z-30 border-b border-white/8 bg-pitch-900/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <NavLink
            to="/"
            className="flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <Shield className="h-7 w-7 text-gold-400" aria-hidden="true" />
            <span className="font-display text-xl font-extrabold uppercase tracking-wide text-ink-50 sm:text-2xl">
              {league.name}
            </span>
          </NavLink>
          <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 font-display text-sm font-bold uppercase tracking-widest text-ink-200 md:inline">
            Week {evaluation.currentWeek}
          </span>
          <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Primary">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 rounded-lg px-3 py-2 font-display text-sm font-bold uppercase tracking-wide text-ink-200 hover:bg-white/5 hover:text-ink-50 focus-visible:ring-2 focus-visible:ring-sky-400',
                    isActive && 'bg-white/10 text-ink-50',
                  )
                }
              >
                <Icon className="h-4 w-4" aria-hidden="true" /> {label}
              </NavLink>
            ))}
            {viewer.isCommissioner && !readOnly && (
              <NavLink
                to="/commissioner"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 rounded-lg px-3 py-2 font-display text-sm font-bold uppercase tracking-wide text-gold-300 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-sky-400',
                    isActive && 'bg-white/10',
                  )
                }
              >
                <Crown className="h-4 w-4" aria-hidden="true" /> Commissioner
              </NavLink>
            )}
          </nav>
          <div className={cn('ml-auto flex items-center gap-2 md:ml-2', readOnly && 'hidden')}>
            {session && me ? (
              <>
                <NavLink
                  to="/me"
                  className="flex items-center gap-2 rounded-full focus-visible:ring-2 focus-visible:ring-sky-400"
                  aria-label={`Signed in as ${me.displayName}`}
                >
                  <Headshot name={me.displayName} playerId={me.playerId} size="xs" />
                  <span className="hidden text-sm font-medium text-ink-100 lg:inline">
                    {me.displayName}
                  </span>
                </NavLink>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void services.auth.signOut()}
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Sign out</span>
                </Button>
              </>
            ) : (
              <Button variant="secondary" size="sm" asChild>
                <NavLink to="/sign-in">
                  <LogIn className="h-4 w-4" aria-hidden="true" /> Sign in
                </NavLink>
              </Button>
            )}
          </div>
        </div>
      </header>
      <main
        id="main"
        className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-24 md:pb-10"
        tabIndex={-1}
      >
        <Outlet />
      </main>
      <footer className="hidden border-t border-white/8 py-6 text-center text-xs text-ink-400 md:block">
        {league.tagline ??
          'Pick one team to win each week. Lose or tie and you burn a life. Last one standing wins.'}
        {' · '}
        <NavLink to="/rules" className="underline underline-offset-2 hover:text-ink-100">
          Official rules
        </NavLink>
        {' · '}
        <span>Times shown in your local timezone.</span>
      </footer>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-pitch-900/95 backdrop-blur md:hidden"
        aria-label="Primary mobile"
      >
        <ul
          className="grid"
          style={{ gridTemplateColumns: `repeat(${NAV.length}, minmax(0, 1fr))` }}
        >
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-0.5 py-2 font-display text-[11px] font-bold uppercase tracking-wider text-ink-300',
                    isActive && 'text-gold-300',
                  )
                }
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
        {viewer.isCommissioner && !readOnly && (
          <NavLink
            to="/commissioner"
            className="block border-t border-white/10 py-1.5 text-center font-display text-[11px] font-bold uppercase tracking-widest text-gold-300"
          >
            <ListOrdered className="mr-1 inline h-3 w-3" aria-hidden="true" /> Commissioner tools
          </NavLink>
        )}
      </nav>
    </div>
  )
}

/**
 * Shown only where editing is actually possible: the commissioner's own
 * machine. The published build has no write controls at all, so it needs no
 * warning about them.
 */
function DemoBanner() {
  return (
    <div className="bg-sky-400/15 px-4 py-1.5 text-center text-xs text-sky-400" role="note">
      <strong className="font-display uppercase tracking-widest">Local commissioner mode</strong> —{' '}
      edits are saved in this browser only. Export and commit the league to publish them.
    </div>
  )
}
