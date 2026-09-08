import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Check, Lock, Search } from 'lucide-react'
import { useLeagueContext } from '@/app/hooks'
import { useServices, useSession } from '@/app/hooks'
import { useSubmitPick } from '@/app/queries'
import { getTeam, getTeamOptions, readableTextColor, weekSummary, type TeamOption } from '@/domain'
import { DataError, type RuleViolation } from '@/data'
import { TeamMonogram } from '@/components/TeamMonogram'
import { Countdown } from '@/components/Countdown'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ridingWith } from '@/lib/copy'
import { formatKickoff } from '@/lib/time'
import { cn } from '@/lib/cn'

export function PickPage() {
  const session = useSession()
  const { snapshot, evaluation } = useLeagueContext()
  const { clock } = useServices()
  const submit = useSubmitPick()
  const playerId = session!.actor.playerId
  const me = evaluation.standings.find((s) => s.playerId === playerId)
  const week = evaluation.currentWeek
  const summary = weekSummary(evaluation, week)
  const [query, setQuery] = useState('')
  const [candidate, setCandidate] = useState<TeamOption | null>(null)
  const [violations, setViolations] = useState<RuleViolation[]>([])
  const [confirmed, setConfirmed] = useState<string | null>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  const options = useMemo(
    () => getTeamOptions(snapshot, evaluation, playerId, week, clock.now()),
    [snapshot, evaluation, playerId, week, clock],
  )
  const q = query.trim().toLowerCase()
  const matches = (o: TeamOption) =>
    !q || o.team.fullName.toLowerCase().includes(q) || o.team.abbreviation.toLowerCase().includes(q)
  const byKickoff = (a: TeamOption, b: TeamOption) =>
    (a.kickoffAt ?? '').localeCompare(b.kickoffAt ?? '') || a.team.name.localeCompare(b.team.name)
  const groups = {
    available: options
      .filter((o) => (o.state === 'available' || o.state === 'selected') && matches(o))
      .sort(byKickoff),
    locked: options
      .filter(
        (o) =>
          (o.state === 'locked' || o.state === 'postponed' || o.state === 'cancelled') &&
          matches(o),
      )
      .sort(byKickoff),
    used: options
      .filter((o) => o.state === 'used' && matches(o))
      .sort((a, b) => (a.usedWeek ?? 0) - (b.usedWeek ?? 0)),
    bye: options.filter((o) => o.state === 'bye' && matches(o)),
  }
  const selected = options.find((o) => o.state === 'selected') ?? null
  const currentLocked = me?.history.find((h) => h.week === week)?.locked ?? false

  if (!me || me.status !== 'alive') {
    return (
      <div className="card p-8 text-center">
        <h1 className="text-3xl text-ink-50">
          {me?.status === 'eliminated' ? 'Picks are closed for you' : 'No pick needed'}
        </h1>
        <p className="mt-2 text-ink-300">
          {me?.status === 'eliminated'
            ? `You were eliminated in week ${me.eliminatedWeek}. Cheer from the graveyard.`
            : 'Nothing to do here.'}
        </p>
        <Button className="mt-5" variant="secondary" asChild>
          <Link to="/">League home</Link>
        </Button>
      </div>
    )
  }

  const confirm = async () => {
    if (!candidate) return
    setViolations([])
    try {
      const result = await submit.mutateAsync({
        seasonId: snapshot.season.id,
        playerId,
        week,
        teamId: candidate.team.id,
        expectedVersion: selected ? me.currentPick?.version : undefined,
      })
      if (result.ok) {
        setConfirmed(candidate.team.id)
        setCandidate(null)
      } else {
        setViolations(result.violations)
      }
    } catch (err) {
      setViolations([
        {
          code: err instanceof DataError ? err.code : 'ERROR',
          message: err instanceof Error ? err.message : 'Could not save your pick.',
        },
      ])
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">
            Week {week} · {me.livesRemaining} {me.livesRemaining === 1 ? 'life' : 'lives'} left
          </p>
          <h1 className="text-4xl font-extrabold text-ink-50 md:text-5xl">Make your pick</h1>
          <p className="mt-1 text-ink-300">
            One team to win. Lose or tie and you burn a life. A team can only be used once all
            season.
          </p>
        </div>
        {summary?.deadlineAt && summary.phase === 'open' && (
          <p className="text-sm text-ink-300">Last kickoff {formatKickoff(summary.deadlineAt)}</p>
        )}
      </header>

      {(selected || confirmed) && (
        <div
          className={cn(
            'card flex items-center gap-4 border-turf-500/40 p-4',
            confirmed && 'animate-rise',
          )}
          role="status"
          aria-live="polite"
        >
          <TeamMonogram
            teamId={(selected ?? options.find((o) => o.team.id === confirmed))!.team.id}
            size="lg"
          />
          <div className="flex-1">
            <p className="font-display text-2xl font-extrabold uppercase text-ink-50">
              {ridingWith(getTeam(selected?.team.id ?? confirmed!)?.fullName ?? '', week)}
            </p>
            {selected?.kickoffAt && (
              <p className="text-sm text-ink-300">
                {selected.isHome ? 'vs' : 'at'} {getTeam(selected.opponentId ?? '')?.name} ·{' '}
                {formatKickoff(selected.kickoffAt)} ·{' '}
                {currentLocked ? (
                  <span className="text-gold-300">Locked</span>
                ) : (
                  <Countdown to={selected.kickoffAt} />
                )}
              </p>
            )}
            {!currentLocked && (
              <p className="mt-1 text-xs text-ink-400">
                You can change this until kickoff. Tap any available team below.
              </p>
            )}
          </div>
          <Check className="h-8 w-8 text-turf-400" aria-hidden="true" />
        </div>
      )}

      {violations.length > 0 && (
        <div className="card animate-shake border-flag-500/50 p-4" role="alert">
          <p className="font-display text-lg font-bold uppercase text-flag-400">
            That pick didn’t go through
          </p>
          <ul className="mt-1 list-disc pl-5 text-sm text-ink-200">
            {violations.map((v) => (
              <li key={v.code}>{v.message}</li>
            ))}
          </ul>
        </div>
      )}

      {currentLocked ? (
        <p className="text-ink-300">
          Your game has kicked off — this week’s pick is locked. Good luck.
        </p>
      ) : summary?.phase !== 'open' ? (
        <p className="text-ink-300">Picks aren’t open right now.</p>
      ) : (
        <>
          <div className="relative max-w-sm">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-400"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a team"
              aria-label="Find a team"
              className="pl-9"
            />
          </div>

          <TeamGroup
            title="Available"
            hint="Tap a card to ride with that team."
            options={groups.available}
            onSelect={setCandidate}
          />
          <TeamGroup
            title="Already kicked off"
            hint="Too late for these."
            options={groups.locked}
          />
          <TeamGroup
            title="Already used"
            hint="You've burned these. Choose wisely next time."
            options={groups.used}
          />
          <TeamGroup title="On bye" hint="Not playing this week." options={groups.bye} />
        </>
      )}

      <Dialog open={!!candidate} onOpenChange={(open) => !open && setCandidate(null)}>
        {candidate && (
          <DialogContent
            title="Lock it in?"
            description={`Week ${week}. You can still change your mind until kickoff.`}
            onOpenAutoFocus={(e) => {
              e.preventDefault()
              confirmRef.current?.focus()
            }}
          >
            <div className="flex items-center gap-4">
              <TeamMonogram teamId={candidate.team.id} size="xl" />
              <div>
                <p className="font-display text-2xl font-extrabold uppercase text-ink-50">
                  {ridingWith(candidate.team.fullName, week)}
                </p>
                <p className="text-sm text-ink-300">
                  {candidate.isHome ? 'vs' : 'at'} {getTeam(candidate.opponentId ?? '')?.fullName}
                  {candidate.kickoffAt && ` · ${formatKickoff(candidate.kickoffAt)}`}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCandidate(null)}>
                Not yet
              </Button>
              <Button ref={confirmRef} onClick={() => void confirm()} disabled={submit.isPending}>
                {submit.isPending ? 'Saving…' : selected ? 'Change my pick' : 'Ride with them'}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}

function TeamGroup({
  title,
  hint,
  options,
  onSelect,
}: {
  title: string
  hint: string
  options: TeamOption[]
  onSelect?: (o: TeamOption) => void
}) {
  if (options.length === 0) return null
  return (
    <section aria-labelledby={`group-${title}`}>
      <div className="mb-3 flex items-baseline gap-3">
        <h2 id={`group-${title}`} className="text-2xl text-ink-50">
          {title} <span className="text-ink-400">({options.length})</span>
        </h2>
        <p className="text-xs text-ink-400">{hint}</p>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {options.map((o) => (
          <li key={o.team.id}>
            <TeamPickCard option={o} onSelect={onSelect} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function TeamPickCard({
  option,
  onSelect,
}: {
  option: TeamOption
  onSelect?: (o: TeamOption) => void
}) {
  const { team, state, opponentId, isHome, kickoffAt, usedWeek } = option
  const opponent = opponentId ? getTeam(opponentId) : null
  const selectable = !!onSelect && (state === 'available' || state === 'selected')
  const muted =
    state === 'used' ||
    state === 'bye' ||
    state === 'locked' ||
    state === 'cancelled' ||
    state === 'postponed'
  const label =
    state === 'selected'
      ? 'Your pick'
      : state === 'used'
        ? `Used week ${usedWeek}`
        : state === 'bye'
          ? 'Bye'
          : state === 'locked'
            ? 'Kicked off'
            : state === 'cancelled'
              ? 'Cancelled'
              : state === 'postponed'
                ? 'Postponed'
                : 'Available'
  const body = (
    <>
      <div className="flex items-center gap-3">
        <TeamMonogram teamId={team.id} size="md" muted={muted} />
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate font-display text-lg font-bold uppercase leading-tight">
            {team.name}
          </p>
          <p className="truncate text-xs opacity-80">
            {team.location} · {team.abbreviation}
          </p>
        </div>
        {state === 'selected' && <Check className="h-6 w-6 text-turf-400" aria-hidden="true" />}
        {(state === 'locked' || state === 'used') && (
          <Lock className="h-4 w-4 opacity-60" aria-hidden="true" />
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="opacity-90">
          {opponent ? `${isHome ? 'vs' : 'at'} ${opponent.abbreviation}` : 'No game'}
        </span>
        <span className="opacity-90">{kickoffAt ? formatKickoff(kickoffAt) : label}</span>
      </div>
      <span
        className={cn(
          'absolute top-2 right-2 rounded-full px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider',
          state === 'selected'
            ? 'bg-turf-500 text-pitch-950'
            : state === 'available'
              ? 'bg-white/10 text-ink-100'
              : 'bg-black/30 text-ink-200',
        )}
      >
        {label}
      </span>
    </>
  )
  const style =
    selectable && state !== 'selected'
      ? {
          background: `linear-gradient(135deg, ${team.colors.primary}, ${team.colors.primary}cc 60%, ${team.colors.secondary})`,
          color: readableTextColor(team.colors.primary),
        }
      : undefined
  const classes = cn(
    'card relative block w-full min-h-24 p-3 transition',
    selectable &&
      'hover:-translate-y-0.5 hover:shadow-glow focus-visible:ring-2 focus-visible:ring-sky-400 active:translate-y-0',
    state === 'selected' && 'border-turf-500 [--glow:rgba(34,197,94,0.5)] shadow-glow',
    muted && 'opacity-60',
  )
  if (selectable) {
    return (
      <button
        type="button"
        className={classes}
        style={style}
        onClick={() => onSelect?.(option)}
        aria-pressed={state === 'selected'}
        aria-label={`${team.fullName}, ${opponent ? `${isHome ? 'home vs' : 'away at'} ${opponent.fullName}` : ''}, ${kickoffAt ? formatKickoff(kickoffAt) : ''}, ${label}`}
      >
        {body}
      </button>
    )
  }
  return (
    <div className={classes} role="group" aria-label={`${team.fullName}: ${label}`}>
      {body}
    </div>
  )
}
