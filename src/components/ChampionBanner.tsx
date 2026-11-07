import { forwardRef } from 'react'
import { Crown } from 'lucide-react'
import type { Banner } from '@/lib/champions'
import { Headshot } from './Headshot'
import { cn } from '@/lib/cn'

export interface ChampionBannerProps {
  banner: Banner
  league: string
  /** Unroll when it first appears (the league home); a hall of them just hangs. */
  unroll?: boolean
  className?: string
}

/**
 * A champion's banner, hung from a gold rod like a banner in the rafters:
 * the year, the crown, their headshot and name, the league's name at the
 * foot, cut to a point at the bottom. On the league home it unrolls when the
 * page opens and then hangs, swaying a little; viewers who prefer reduced
 * motion get it already hung.
 */
export const ChampionBanner = forwardRef<HTMLDivElement, ChampionBannerProps>(
  function ChampionBanner({ banner, league, unroll, className }, ref) {
    const many = banner.winners.length > 1
    return (
      <figure
        className={cn('rafter', unroll && 'rafter-unroll', className)}
        aria-label={`${banner.year} ${many ? 'co-champions' : 'champion'}: ${banner.winners.map((w) => w.name).join(' and ')}`}
      >
        <div className="rafter-rod" aria-hidden="true" />
        <div className="rafter-cloth" ref={ref}>
          <div className="rafter-face">
            <p className="rafter-year">{banner.year}</p>
            <p className="rafter-title">
              <Crown className="h-4 w-4" aria-hidden="true" />
              {many ? 'Co-champions' : 'Champion'}
            </p>
            <div className="mt-4 flex flex-wrap items-start justify-center gap-5">
              {banner.winners.map((w) => (
                <div key={w.playerId} className="flex flex-col items-center gap-2">
                  <Headshot
                    name={w.name}
                    playerId={w.playerId}
                    size={many ? 'md' : 'lg'}
                    status={many ? 'co-champion' : 'champion'}
                  />
                  <p className="rafter-name">{w.name}</p>
                </div>
              ))}
            </div>
            <p className="rafter-league">{league}</p>
          </div>
        </div>
        {unroll && <div className="rafter-roll" aria-hidden="true" />}
      </figure>
    )
  },
)
