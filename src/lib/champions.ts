/**
 * The banners in the rafters: one for every season's champion.
 *
 * This season's banner comes from the engine the moment the season is
 * decided. When a new season starts, its champion is written into `HALL`
 * (newest first) so their banner stays up after this season's data is gone.
 * The Hall of Champions page (src/features/champions) hangs them all.
 */
export interface Banner {
  year: number
  winners: { playerId: string; name: string }[]
}

/** Past seasons' champions, newest first. */
export const HALL: Banner[] = []

/** Every banner, newest first: this season's (if decided) and the hall's. */
export function banners(current: Banner | null, hall: readonly Banner[] = HALL): Banner[] {
  const past = hall.filter((b) => b.year !== current?.year)
  return [...(current ? [current] : []), ...past].sort((a, b) => b.year - a.year)
}
