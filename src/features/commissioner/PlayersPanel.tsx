import { useState, type FormEvent } from 'react'
import { useLeagueContext } from '@/app/hooks'
import { useServices } from '@/app/hooks'
import { useInvalidateSeason } from '@/app/queries'
import type { LeagueMembership, PlayerProfile } from '@/domain'
import { Headshot } from '@/components/Headshot'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input, Label, Select } from '@/components/ui/input'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Notice } from '@/components/Notice'
import { errorMessage } from '@/lib/errors'
import { HeadshotUploader } from './HeadshotUploader'

export function PlayersPanel() {
  const { snapshot, evaluation, profileOf } = useLeagueContext()
  const { players } = useServices()
  const invalidate = useInvalidateSeason()
  const [editing, setEditing] = useState<LeagueMembership | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [adding, setAdding] = useState(false)

  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formEl = e.currentTarget
    const form = new FormData(formEl)
    const displayName = String(form.get('displayName') ?? '').trim()
    if (!displayName) return
    setAdding(true)
    try {
      await players.addMember({
        seasonId: snapshot.season.id,
        displayName,
        nickname: String(form.get('nickname') ?? '').trim() || undefined,
        role: (form.get('role') as 'player' | 'commissioner') ?? 'player',
      })
      invalidate()
      setNotice({
        tone: 'success',
        text: `${displayName} added with ${snapshot.league.settings.defaultLives} lives.`,
      })
      formEl.reset()
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) })
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => void add(e)}
        className="card grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
        aria-label="Add a player"
      >
        <div>
          <Label htmlFor="add-name">Name</Label>
          <Input id="add-name" name="displayName" required placeholder="Jordan Lee" />
        </div>
        <div>
          <Label htmlFor="add-nick">Nickname</Label>
          <Input id="add-nick" name="nickname" placeholder="Optional" />
        </div>
        <div>
          <Label htmlFor="add-role">Role</Label>
          <Select id="add-role" name="role" defaultValue="player">
            <option value="player">Player</option>
            <option value="commissioner">Commissioner</option>
          </Select>
        </div>
        <Button type="submit" disabled={adding}>
          Add player
        </Button>
      </form>
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {snapshot.memberships.map((m) => {
          const profile = profileOf(m.playerId)
          const standing = evaluation.standings.find((s) => s.playerId === m.playerId)
          return (
            <li
              key={m.id}
              className={`card flex items-center gap-3 p-3 ${m.status === 'inactive' ? 'opacity-60' : ''}`}
            >
              <Headshot
                name={profile.displayName}
                playerId={profile.playerId}
                size="md"
                status={standing?.status}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg font-bold uppercase text-ink-50">
                  {profile.displayName}
                </p>
                <p className="truncate text-xs text-ink-300">
                  {m.role === 'commissioner' ? 'Commissioner · ' : ''}
                  {profile.nickname ? `“${profile.nickname}” · ` : ''}
                  {m.status}
                  {m.livesOverride ? ` · ${m.livesOverride} lives` : ''}
                </p>
                {standing && (
                  <div className="mt-1">
                    <StatusBadge standing={standing} />
                  </div>
                )}
              </div>
              <Button variant="secondary" size="sm" onClick={() => setEditing(m)}>
                Edit
              </Button>
            </li>
          )
        })}
      </ul>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <EditMemberDialog
            membership={editing}
            profile={profileOf(editing.playerId)}
            onDone={() => setEditing(null)}
          />
        )}
      </Dialog>
    </div>
  )
}

function EditMemberDialog({
  membership,
  profile,
  onDone,
}: {
  membership: LeagueMembership
  profile: PlayerProfile
  onDone: () => void
}) {
  const { players } = useServices()
  const invalidate = useInvalidateSeason()
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setBusy(true)
    setNotice(null)
    try {
      await players.upsertProfile({
        ...profile,
        displayName:
          String(form.get('displayName') ?? profile.displayName).trim() || profile.displayName,
        nickname: String(form.get('nickname') ?? '').trim() || undefined,
        tagline: String(form.get('tagline') ?? '').trim() || undefined,
      })
      const lives = String(form.get('lives') ?? '')
      const patch = {
        status: form.get('status') as 'active' | 'inactive',
        role: form.get('role') as 'player' | 'commissioner',
        livesOverride: lives === '' ? undefined : Number(lives),
      }
      const reason = String(form.get('reason') ?? '').trim() || 'commissioner edit'
      if (
        patch.status !== membership.status ||
        patch.role !== membership.role ||
        patch.livesOverride !== membership.livesOverride
      ) {
        await players.updateMembership(membership.id, patch, reason)
      }
      invalidate()
      setNotice({ tone: 'success', text: 'Saved.' })
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <DialogContent
      title={profile.displayName}
      description="Edit profile, role, status, lives and headshot."
      className="max-h-[90vh] overflow-y-auto"
    >
      <HeadshotUploader profile={profile} />
      <form onSubmit={(e) => void save(e)} className="mt-5 grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="e-name">Name</Label>
          <Input id="e-name" name="displayName" defaultValue={profile.displayName} required />
        </div>
        <div>
          <Label htmlFor="e-nick">Nickname</Label>
          <Input id="e-nick" name="nickname" defaultValue={profile.nickname ?? ''} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="e-tag">Tagline</Label>
          <Input id="e-tag" name="tagline" defaultValue={profile.tagline ?? ''} maxLength={120} />
        </div>
        <div>
          <Label htmlFor="e-role">Role</Label>
          <Select id="e-role" name="role" defaultValue={membership.role}>
            <option value="player">Player</option>
            <option value="commissioner">Commissioner</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="e-status">Status</Label>
          <Select id="e-status" name="status" defaultValue={membership.status}>
            <option value="active">Active</option>
            <option value="inactive">Inactive (deactivated)</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="e-lives">Lives override</Label>
          <Input
            id="e-lives"
            name="lives"
            type="number"
            min={1}
            max={10}
            defaultValue={membership.livesOverride ?? ''}
            placeholder="League default"
          />
        </div>
        <div>
          <Label htmlFor="e-reason">Reason (audited)</Label>
          <Input id="e-reason" name="reason" placeholder="e.g. joined late" />
        </div>
        {notice && (
          <div className="sm:col-span-2">
            <Notice tone={notice.tone}>{notice.text}</Notice>
          </div>
        )}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="ghost" onClick={onDone}>
            Close
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </DialogContent>
  )
}
