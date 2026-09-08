import { Crown, Flame, Heart, Skull } from 'lucide-react'
import type { PlayerStanding } from '@/domain'
import { statusHeadline } from '@/lib/copy'
import { Badge } from './ui/badge'

export function StatusBadge({ standing }: { standing: PlayerStanding }) {
  const s = standing.status
  if (s === 'champion' || s === 'co-champion')
    return (
      <Badge tone="champion">
        <Crown className="h-3 w-3" aria-hidden="true" /> {statusHeadline(s)}
      </Badge>
    )
  if (s === 'eliminated')
    return (
      <Badge tone="out">
        <Skull className="h-3 w-3" aria-hidden="true" /> Eliminated
      </Badge>
    )
  if (s === 'finalist') return <Badge tone="bubble">Tied finalist</Badge>
  if (s === 'inactive') return <Badge tone="neutral">Inactive</Badge>
  if (standing.livesRemaining === 1)
    return (
      <Badge tone="bubble">
        <Flame className="h-3 w-3" aria-hidden="true" /> On the bubble
      </Badge>
    )
  if (standing.strikes === 0 && standing.weeksSurvived >= 3)
    return (
      <Badge tone="alive">
        <Heart className="h-3 w-3" aria-hidden="true" /> Perfect
      </Badge>
    )
  return <Badge tone="alive">Still alive</Badge>
}
