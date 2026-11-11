import { Link } from 'react-router'
import { useLeagueContext } from '@/app/hooks'
import { ChampionBanner } from '@/components/ChampionBanner'
import { Trophy } from '@/components/Trophy'
import { useCurrentBanner } from '@/app/useCurrentBanner'
import { banners } from '@/lib/champions'

/**
 * The Hall of Champions: the trophy, and every season's banner hung in a row
 * in the rafters, newest first.
 */
export function HallOfChampions() {
  const { league, snapshot } = useLeagueContext()
  const current = useCurrentBanner()
  const hung = banners(current)
  return (
    <div className="space-y-10">
      <header className="text-center">
        <p className="eyebrow">{league.name}</p>
        <h1 className="text-4xl font-extrabold text-ink-50 md:text-5xl">Hall of Champions</h1>
        <p className="mx-auto mt-2 max-w-prose text-ink-300">
          Every last one standing, hung in the rafters for good.
        </p>
      </header>

      <Trophy name={hung[0]?.winners.map((w) => w.name).join(' & ')} />

      {hung.length ? (
        <ul className="flex flex-wrap items-start justify-center gap-x-10 gap-y-12 pt-4">
          {hung.map((b) => (
            <li key={b.year} className="w-72">
              <ChampionBanner banner={b} league={league.name} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="card mx-auto max-w-xl p-6 text-center text-ink-200">
          No banners yet. The first one goes up when the {snapshot.season.year} season is decided.{' '}
          <Link to="/leaderboard" className="text-gold-300 underline underline-offset-2">
            See who’s still standing
          </Link>
          .
        </p>
      )}
    </div>
  )
}
