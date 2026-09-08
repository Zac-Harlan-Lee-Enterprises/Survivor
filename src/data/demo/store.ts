import { z } from 'zod'
import {
  AuditEventSchema,
  CommissionerOverrideSchema,
  SeasonSnapshotSchema,
  type AuditEvent,
  type CommissionerOverride,
  type SeasonSnapshot,
} from '@/domain'

/**
 * Demo persistence: the seeded fixture plus a localStorage overlay.
 *
 * localStorage is per-browser, per-device. It is NOT shared between users and
 * is NOT authoritative — it exists so a visitor (or the commissioner trying
 * things out) can make picks and see the app react. Connected mode replaces
 * this with the AWS API.
 */

export const DemoStateSchema = z.object({
  version: z.literal(1),
  snapshot: SeasonSnapshotSchema,
  audit: z.array(AuditEventSchema),
  overrides: z.array(CommissionerOverrideSchema),
  sessionPlayerId: z.string().nullable(),
})
export type DemoState = z.infer<typeof DemoStateSchema>

export const DEMO_STORAGE_KEY = 'survivor:demo:state:v1'

export type Listener = () => void

export class DemoStore {
  private state: DemoState
  private listeners = new Set<Listener>()
  private readonly fixture: SeasonSnapshot
  private readonly storage: Storage | null

  constructor(fixture: SeasonSnapshot, storage: Storage | null) {
    this.fixture = fixture
    this.storage = storage
    this.state = this.load()
  }

  private fresh(): DemoState {
    return {
      version: 1,
      snapshot: structuredClone(this.fixture),
      audit: [],
      overrides: [],
      sessionPlayerId: null,
    }
  }

  private load(): DemoState {
    try {
      const raw = this.storage?.getItem(DEMO_STORAGE_KEY)
      if (!raw) return this.fresh()
      const parsed = DemoStateSchema.safeParse(JSON.parse(raw))
      if (!parsed.success) return this.fresh()
      // Fixture upgrades: if the seeded season changed, start over rather than
      // mixing two generations of data.
      if (parsed.data.snapshot.season.id !== this.fixture.season.id) return this.fresh()
      return parsed.data
    } catch {
      return this.fresh()
    }
  }

  private persist(): void {
    try {
      this.storage?.setItem(DEMO_STORAGE_KEY, JSON.stringify(this.state))
    } catch {
      /* quota exceeded or unavailable — demo keeps working in memory */
    }
  }

  get(): DemoState {
    return this.state
  }

  snapshot(): SeasonSnapshot {
    return this.state.snapshot
  }

  update(mutator: (draft: DemoState) => void): void {
    const draft = structuredClone(this.state)
    mutator(draft)
    this.state = draft
    this.persist()
    for (const l of this.listeners) l()
  }

  audit(event: Omit<AuditEvent, 'id' | 'leagueId' | 'at'> & { at: string }): void {
    this.update((d) => {
      d.audit.unshift({
        ...event,
        id: `audit-${d.audit.length + 1}-${event.at}`,
        leagueId: d.snapshot.league.id,
      })
    })
  }

  override(entry: Omit<CommissionerOverride, 'id' | 'leagueId' | 'seasonId'>): void {
    this.update((d) => {
      d.overrides.unshift({
        ...entry,
        id: `override-${d.overrides.length + 1}-${entry.createdAt}`,
        leagueId: d.snapshot.league.id,
        seasonId: d.snapshot.season.id,
      })
    })
  }

  reset(): void {
    this.state = this.fresh()
    try {
      this.storage?.removeItem(DEMO_STORAGE_KEY)
    } catch {
      /* ignore */
    }
    for (const l of this.listeners) l()
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}
