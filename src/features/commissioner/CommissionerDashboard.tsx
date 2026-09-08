import { useNavigate, useParams } from 'react-router'
import { useLeagueContext } from '@/app/hooks'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PlayersPanel } from './PlayersPanel'
import { PicksPanel } from './PicksPanel'
import { ResultsPanel } from './ResultsPanel'
import { SettingsPanel } from './SettingsPanel'
import { ImportPanel } from './ImportPanel'
import { AuditPanel } from './AuditPanel'

const TABS = [
  { id: 'players', label: 'Players' },
  { id: 'picks', label: 'Picks' },
  { id: 'results', label: 'Results' },
  { id: 'settings', label: 'Settings' },
  { id: 'import', label: 'Import' },
  { id: 'audit', label: 'Audit' },
] as const
type TabId = (typeof TABS)[number]['id']

export function CommissionerDashboard() {
  const { tab } = useParams()
  const navigate = useNavigate()
  const { evaluation, league } = useLeagueContext()
  const active: TabId = TABS.some((t) => t.id === tab) ? (tab as TabId) : 'players'

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">
          {league.name} · week {evaluation.currentWeek}
        </p>
        <h1 className="text-4xl font-extrabold text-ink-50 md:text-5xl">Commissioner</h1>
        <p className="mt-1 max-w-prose text-ink-300">
          Every change here is audited. Standings are derived from picks and results, so a
          correction recalculates everything automatically.
        </p>
      </header>
      <Tabs value={active} onValueChange={(v) => navigate(`/commissioner/${v}`)}>
        <TabsList aria-label="Commissioner sections">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="players" className="mt-6 focus-visible:outline-none">
          <PlayersPanel />
        </TabsContent>
        <TabsContent value="picks" className="mt-6 focus-visible:outline-none">
          <PicksPanel />
        </TabsContent>
        <TabsContent value="results" className="mt-6 focus-visible:outline-none">
          <ResultsPanel />
        </TabsContent>
        <TabsContent value="settings" className="mt-6 focus-visible:outline-none">
          <SettingsPanel />
        </TabsContent>
        <TabsContent value="import" className="mt-6 focus-visible:outline-none">
          <ImportPanel />
        </TabsContent>
        <TabsContent value="audit" className="mt-6 focus-visible:outline-none">
          <AuditPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
