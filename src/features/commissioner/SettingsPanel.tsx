import { useState, type FormEvent } from 'react'
import { useLeagueContext, useLeagueTimeZone } from '@/app/hooks'
import { useServices } from '@/app/hooks'
import { useInvalidateSeason } from '@/app/queries'
import { LeagueSettingsSchema } from '@/domain'
import { Button } from '@/components/ui/button'
import { Input, Label, Select } from '@/components/ui/input'
import { Notice } from '@/components/Notice'
import { errorMessage } from '@/lib/errors'
import { formatDateTime } from '@/lib/time'

export function SettingsPanel() {
  const tz = useLeagueTimeZone()
  const { league, snapshot, evaluation, profileOf } = useLeagueContext()
  const services = useServices()
  const invalidate = useInvalidateSeason()
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const s = league.settings

  const saveSettings = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setBusy(true)
    setNotice(null)
    try {
      const parsed = LeagueSettingsSchema.parse({
        defaultLives: Number(form.get('defaultLives')),
        tieCountsAsMiss: form.get('tieCountsAsMiss') === 'on',
        missingPickCountsAsMiss: form.get('missingPickCountsAsMiss') === 'on',
        cancelledGamePolicy: form.get('cancelledGamePolicy'),
        simultaneousEliminationPolicy: form.get('simultaneousEliminationPolicy'),
        hidePicksUntilLocked: form.get('hidePicksUntilLocked') === 'on',
        displayTimeZone: String(form.get('displayTimeZone') || s.displayTimeZone),
      })
      await services.leagues.updateSettings(
        league.id,
        parsed,
        String(form.get('reason') ?? '').trim() || 'settings updated',
      )
      await services.leagues.updateSeason(snapshot.season.id, {
        label: String(form.get('label') ?? snapshot.season.label).trim() || snapshot.season.label,
        status: form.get('status') as 'upcoming' | 'active' | 'complete',
        startWeek: Number(form.get('startWeek')),
        endWeek: Number(form.get('endWeek')),
      })
      invalidate()
      setNotice({
        tone: 'success',
        text: 'Settings saved. Standings recalculated with the new rules.',
      })
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  const decide = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const ids = form.getAll('champion').map(String)
    const reason = String(form.get('dreason') ?? '').trim()
    if (ids.length === 0 || !reason) {
      setNotice({ tone: 'error', text: 'Choose at least one champion and give a reason.' })
      return
    }
    setBusy(true)
    try {
      await services.leagues.recordDecision({
        seasonId: snapshot.season.id,
        championPlayerIds: ids,
        reason,
      })
      invalidate()
      setNotice({ tone: 'success', text: 'Champion recorded. Cue the confetti.' })
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  const candidates = evaluation.standings.filter(
    (x) =>
      x.status === 'finalist' ||
      x.status === 'alive' ||
      x.status === 'champion' ||
      x.status === 'co-champion',
  )

  return (
    <div className="space-y-8">
      <form
        onSubmit={(e) => void saveSettings(e)}
        className="card grid gap-4 p-5 sm:grid-cols-2"
        aria-labelledby="st-title"
      >
        <h2 id="st-title" className="text-2xl text-ink-50 sm:col-span-2">
          League rules
        </h2>
        <div>
          <Label htmlFor="st-lives">Default lives</Label>
          <Input
            id="st-lives"
            name="defaultLives"
            type="number"
            min={1}
            max={10}
            defaultValue={s.defaultLives}
          />
        </div>
        <div>
          <Label htmlFor="st-cancel">Cancelled game</Label>
          <Select id="st-cancel" name="cancelledGamePolicy" defaultValue={s.cancelledGamePolicy}>
            <option value="void">Void the pick (team returns to pool)</option>
            <option value="miss">Counts as a miss</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="st-sim">Everyone out the same week</Label>
          <Select
            id="st-sim"
            name="simultaneousEliminationPolicy"
            defaultValue={s.simultaneousEliminationPolicy}
          >
            <option value="co-champions">Co-champions</option>
            <option value="commissioner-decides">Tied finalists — commissioner decides</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="st-tz">Display timezone (fallback)</Label>
          <Input id="st-tz" name="displayTimeZone" defaultValue={s.displayTimeZone} />
        </div>
        <Check
          name="tieCountsAsMiss"
          label="A tie consumes a life"
          defaultChecked={s.tieCountsAsMiss}
        />
        <Check
          name="missingPickCountsAsMiss"
          label="A missing pick consumes a life after the deadline"
          defaultChecked={s.missingPickCountsAsMiss}
        />
        <Check
          name="hidePicksUntilLocked"
          label="Hide other players' picks until kickoff"
          defaultChecked={s.hidePicksUntilLocked}
        />

        <h2 className="mt-2 text-2xl text-ink-50 sm:col-span-2">Season</h2>
        <div>
          <Label htmlFor="st-label">Label</Label>
          <Input id="st-label" name="label" defaultValue={snapshot.season.label} />
        </div>
        <div>
          <Label htmlFor="st-status">Status</Label>
          <Select id="st-status" name="status" defaultValue={snapshot.season.status}>
            <option value="upcoming">Upcoming</option>
            <option value="active">Active</option>
            <option value="complete">Complete</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="st-start">First week</Label>
          <Input
            id="st-start"
            name="startWeek"
            type="number"
            min={1}
            max={22}
            defaultValue={snapshot.season.startWeek}
          />
        </div>
        <div>
          <Label htmlFor="st-end">Last week</Label>
          <Input
            id="st-end"
            name="endWeek"
            type="number"
            min={1}
            max={22}
            defaultValue={snapshot.season.endWeek}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="st-reason">Reason (audited)</Label>
          <Input id="st-reason" name="reason" placeholder="e.g. league vote on 9/1" />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      </form>

      <form
        onSubmit={(e) => void decide(e)}
        className="card space-y-3 p-5"
        aria-labelledby="dc-title"
      >
        <h2 id="dc-title" className="text-2xl text-ink-50">
          Crown a champion
        </h2>
        <p className="text-sm text-ink-300">
          Used for tiebreakers when everyone goes out together, or to settle a dispute. A recorded
          decision overrides the computed result and is audited.
        </p>
        {snapshot.decision && (
          <p className="text-sm text-gold-300">
            Current decision:{' '}
            {snapshot.decision.championPlayerIds.map((id) => profileOf(id).displayName).join(', ')}{' '}
            — “{snapshot.decision.reason}” ({formatDateTime(snapshot.decision.decidedAt, tz)})
          </p>
        )}
        <fieldset>
          <legend className="mb-1 text-sm text-ink-200">Champion(s)</legend>
          <div className="flex flex-wrap gap-3">
            {candidates.map((c) => (
              <label key={c.playerId} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="champion"
                  value={c.playerId}
                  className="accent-gold-400"
                />{' '}
                {profileOf(c.playerId).displayName}{' '}
                <span className="text-ink-400">({c.status})</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <Label htmlFor="dc-reason">Reason</Label>
          <Input id="dc-reason" name="dreason" placeholder="e.g. tiebreaker: most wins" />
        </div>
        <Button type="submit" variant="secondary" disabled={busy}>
          Record decision
        </Button>
      </form>

      {services.mode === 'demo' && <DemoClockPanel />}
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
    </div>
  )
}

function Check({
  name,
  label,
  defaultChecked,
}: {
  name: string
  label: string
  defaultChecked: boolean
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink-100">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 accent-gold-400"
      />{' '}
      {label}
    </label>
  )
}

function DemoClockPanel() {
  const services = useServices()
  const invalidate = useInvalidateSeason()
  const [value, setValue] = useState(() => services.clock.now().toISOString().slice(0, 16))
  const apply = (d: Date | null) => {
    services.clock.set?.(d)
    invalidate()
    setValue(services.clock.now().toISOString().slice(0, 16))
  }
  return (
    <section className="card space-y-3 border-sky-400/30 p-5" aria-labelledby="clock-title">
      <h2 id="clock-title" className="text-2xl text-sky-400">
        Demo clock
      </h2>
      <p className="text-sm text-ink-300">
        Demo mode pins “now” so the sample season always looks the same. Move it to watch picks
        lock, weeks close and eliminations land.{' '}
        {services.clock.isPinned?.() ? 'Pinned.' : 'Using real time.'}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="clock-value">Now (UTC)</Label>
          <Input
            id="clock-value"
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <Button variant="secondary" onClick={() => apply(new Date(`${value}:00Z`))}>
          Set clock
        </Button>
        <Button
          variant="outline"
          onClick={() => apply(new Date(services.clock.now().getTime() + 24 * 3_600_000))}
        >
          +1 day
        </Button>
        <Button
          variant="outline"
          onClick={() => apply(new Date(services.clock.now().getTime() + 7 * 24 * 3_600_000))}
        >
          +1 week
        </Button>
        <Button variant="ghost" onClick={() => apply(null)}>
          Use real time
        </Button>
        <Button
          variant="danger"
          onClick={() => void services.resetDemo?.().then(() => window.location.reload())}
        >
          Reset demo data
        </Button>
      </div>
    </section>
  )
}
