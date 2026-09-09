/**
 * Presentation-time formatting. Authoritative timestamps are UTC ISO strings;
 * everything here renders them in the viewer's own timezone.
 */

export function viewerTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

export function formatKickoff(
  iso: string,
  opts: { timeZone?: string; withDate?: boolean } = {},
): string {
  const d = new Date(iso)
  const timeZone = opts.timeZone ?? viewerTimeZone()
  const date = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone,
  }).format(d)
  const time = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
  }).format(d)
  return opts.withDate === false ? time : `${date} · ${time}`
}

export function formatDateTime(iso: string, timeZone = viewerTimeZone()): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso))
}

/**
 * The zone's short name at a given instant ("CDT" in summer, "CST" in winter),
 * so a time on screen is never ambiguous about which clock it is on.
 */
export function zoneAbbreviation(timeZone: string, at: Date): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')
    return part?.value ?? timeZone
  } catch {
    return timeZone
  }
}

export interface Countdown {
  totalMs: number
  days: number
  hours: number
  minutes: number
  seconds: number
  past: boolean
}

export function countdownTo(target: string | Date, now: Date): Countdown {
  const totalMs = new Date(target).getTime() - now.getTime()
  const past = totalMs <= 0
  const abs = Math.abs(totalMs)
  return {
    totalMs,
    past,
    days: Math.floor(abs / 86_400_000),
    hours: Math.floor((abs % 86_400_000) / 3_600_000),
    minutes: Math.floor((abs % 3_600_000) / 60_000),
    seconds: Math.floor((abs % 60_000) / 1000),
  }
}

export function formatCountdown(c: Countdown): string {
  if (c.past) return 'Kicked off'
  if (c.days > 0) return `${c.days}d ${c.hours}h`
  if (c.hours > 0) return `${c.hours}h ${c.minutes}m`
  if (c.minutes > 0) return `${c.minutes}m ${c.seconds}s`
  return `${c.seconds}s`
}
