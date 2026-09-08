import { HashRouter, Route, Routes } from 'react-router'
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
            <Route path="sign-in" element={<SignInPage />} />
            <Route
              path="me"
              element={
                <RequireAuth>
                  <PlayerDashboard />
                </RequireAuth>
              }
            />
            <Route
              path="pick"
              element={
                <RequireAuth>
                  <PickPage />
                </RequireAuth>
              }
            />
            <Route
              path="my-season"
              element={
                <RequireAuth>
                  <MySeason />
                </RequireAuth>
              }
            />
            <Route
              path="commissioner/:tab?"
              element={
                <RequireAuth commissioner>
                  <CommissionerDashboard />
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </LeagueProvider>
    </HashRouter>
  )
}
