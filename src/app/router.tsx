import { HashRouter, Navigate, Route, Routes } from 'react-router'
import type { ReactNode } from 'react'
import { getConfig } from '@/config/env'
import { LeagueProvider } from './league'
import { Layout } from './Layout'
import { RequireAuth } from './RequireAuth'
import { LeagueHome } from '@/features/league-home/LeagueHome'
import { PlayerDashboard } from '@/features/player/PlayerDashboard'
import { PickPage } from '@/features/pick/PickPage'
import { Leaderboard } from '@/features/leaderboard/Leaderboard'
import { SeasonGrid } from '@/features/grid/SeasonGrid'
import { MySeason } from '@/features/my-season/MySeason'
import { PlayerProfilePage } from '@/features/profile/PlayerProfilePage'
import { CommissionerDashboard } from '@/features/commissioner/CommissionerDashboard'
import { SignInPage } from '@/features/auth/SignInPage'
import { NotFound } from '@/features/NotFound'

/**
 * HashRouter: GitHub Pages is a static host with no rewrite rules, so every
 * deep link must resolve to index.html. With hash routing the path never
 * leaves "<base>/", which means a refresh on /#/leaderboard can never 404.
 * public/404.html additionally rewrites "clean" URLs into hash URLs.
 */
/**
 * On a published (read-only) build the write routes do not exist as far as a
 * visitor is concerned: they redirect home rather than offering a sign-in that
 * could never lead to a pick anyone else would see.
 */
function Writable({ children }: { children: ReactNode }) {
  if (getConfig().readOnly) return <Navigate to="/" replace />
  return <>{children}</>
}

export function AppRouter() {
  return (
    <HashRouter>
      <LeagueProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<LeagueHome />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="grid" element={<SeasonGrid />} />
            <Route path="players/:playerId" element={<PlayerProfilePage />} />
            <Route
              path="sign-in"
              element={
                <Writable>
                  <SignInPage />
                </Writable>
              }
            />
            <Route
              path="me"
              element={
                <Writable>
                  <RequireAuth>
                    <PlayerDashboard />
                  </RequireAuth>
                </Writable>
              }
            />
            <Route
              path="pick"
              element={
                <Writable>
                  <RequireAuth>
                    <PickPage />
                  </RequireAuth>
                </Writable>
              }
            />
            <Route
              path="my-season"
              element={
                <Writable>
                  <RequireAuth>
                    <MySeason />
                  </RequireAuth>
                </Writable>
              }
            />
            <Route
              path="commissioner/:tab?"
              element={
                <Writable>
                  <RequireAuth commissioner>
                    <CommissionerDashboard />
                  </RequireAuth>
                </Writable>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </LeagueProvider>
    </HashRouter>
  )
}
