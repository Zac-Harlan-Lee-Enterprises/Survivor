import { useState, type FormEvent } from 'react'
import { useLeagueContext } from '@/app/hooks'
import { useServices } from '@/app/hooks'
import { useInvalidateSeason } from '@/app/queries'
import { getTeam, type PlayerStanding } from '@/domain'
import { Headshot } from '@/components/Headshot'
import { OutcomePill } from '@/components/OutcomePill'
import { TeamMonogram } from '@/components/TeamMonogram'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input, Label, Select } from '@/components/ui/input'
import { Notice } from '@/components/Notice'
import { errorMessage } from '@/lib/errors'

/** Every pick, every week — with entry and correction for any cell. */
export function PicksPanel() {
  const { snapshot, evaluation, profileOf } = useLeagueContext()
  const [week, setWeek] = useState(evaluation.currentWeek)
  const [target, setTarget] = useState<{ standing: PlayerStanding } | null>(null)
  const rows = evaluation.standings.filter((s) => s.status !== 'inactive')
  const weekGames = snapshot.games
    .filter((g) => g.week === week)
    .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="pk-week" className="mb-0">
          Week
        </Label>
        <Select
          id="pk-week"
          value={week}
          onChange={(e) => setWeek(Number(e.target.value))}
          className="w-32"
        >
          {evaluation.weeks.map((w) => (
            <option key={w.week} value={w.week}>
              Week {w.week}
              {w.isCurrent ? ' (current)' : ''}
            </option>
          ))}
        </Select>
        <span className="text-sm text-ink-400">
          {weekGames.length} games · picks shown regardless of kickoff (commissioner view).
        </span>
      </div>
      <ul className="card divide-y divide-white/5 p-0">
        {rows.map((s) => {
          const profile = profileOf(s.playerId)
          const h = s.history.find((x) => x.week === week)
          return (
            <li key={s.playerId} className="flex items-center gap-3 p-3 text-sm">
              <Headshot
                name={profile.displayName}
                playerId={profile.playerId}
                size="sm"
                status={s.status}
              />
              <span className="w-40 truncate font-display text-base font-bold uppercase text-ink-50">
                {profile.displayName}
              </span>
              <span className="flex flex-1 items-center gap-2">
                {h?.pick ? (
                  <>
                    <TeamMonogram teamId={h.pick.teamId} size="xs" />{' '}
                    {getTeam(h.pick.teamId)?.fullName}{' '}
                    <span className="text-xs text-ink-400">({h.pick.source})</span>
                  </>
                ) : (
                  <span className="italic text-ink-400">no pick</span>
                )}
              </span>
              {h && <OutcomePill outcome={h.outcome} />}
              <Button variant="secondary" size="sm" onClick={() => setTarget({ standing: s })}>
                Set
              </Button>
            </li>
          )
        })}
      </ul>
      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        {target && (
          <SetPickDialog standing={target.standing} week={week} onDone={() => setTarget(null)} />
        )}
      </Dialog>
    </div>
  )
}

function SetPickDialog({
  standing,
  week,
  onDone,
}: {
  standing: PlayerStanding
  week: number
  onDone: () => void
}) {
  const { snapshot, profileOf } = useLeagueContext()
  const { picks } = useServices()
  const invalidate = useInvalidateSeason()
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const profile = profileOf(standing.playerId)
  const current = standing.history.find((h) => h.week === week)?.pick ?? null
  const teams = snapshot.games
    .filter((g) => g.week === week)
    .flatMap((g) => [g.homeTeamId, g.awayTeamId])
    .sort()

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const teamId = String(form.get('teamId') ?? '')
    const reason = String(form.get('reason') ?? '').trim() || 'commissioner correction'
    setBusy(true)
    setNotice(null)
    try {
      if (teamId === '__clear__') {
        await picks.commissionerClearPick(snapshot.season.id, standing.playerId, week, reason)
        setNotice({ tone: 'success', text: 'Pick cleared.' })
      } else {
        const pick = await picks.commissionerSetPick({
          seasonId: snapshot.season.id,
          playerId: standing.playerId,
          week,
          teamId,
          reason,
        })
        setNotice({
          tone: 'success',
          text: `Week ${week} set to ${getTeam(pick.teamId)?.fullName}.`,
        })
      }
      invalidate()
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <DialogContent
      title={`${profile.displayName} · week ${week}`}
      description="Commissioner entry bypasses the kickoff lock and is recorded in the audit log."
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-3">
        <div>
          <Label htmlFor="sp-team">Team</Label>
          <Select id="sp-team" name="teamId" defaultValue={current?.teamId ?? teams[0] ?? ''}>
            {teams.map((t) => (
              <option key={t} value={t}>
                {getTeam(t)?.fullName}
                {standing.teamsUsed.includes(t) && current?.teamId !== t ? ' — already used!' : ''}
              </option>
            ))}
            {current && <option value="__clear__">— Clear this pick —</option>}
          </Select>
        </div>
        <div>
          <Label htmlFor="sp-reason">Reason</Label>
          <Input id="sp-reason" name="reason" placeholder="e.g. texted pick before kickoff" />
        </div>
        {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onDone}>
            Close
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save pick'}
          </Button>
        </div>
      </form>
    </DialogContent>
  )
}
