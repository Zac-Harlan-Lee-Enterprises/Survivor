/**
 * seed-league — creates the league, season and members in DynamoDB for
 * connected mode. Idempotent: re-running updates the same rows.
 *
 *   TABLE_NAME=<from stack outputs> AWS_REGION=us-east-1 \
 *     npm run api:seed -- infra/seed.example.json
 *
 * This writes to LIVE infrastructure — a human runs it, once, after
 * `sam deploy`. Members sign in with the email listed here; the API links
 * their Cognito identity to the player on first sign-in.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'
import { LeagueSettingsSchema, MembershipRoleSchema } from '../src/domain/models'
import { DynamoStore } from '../backend/src/lib/dynamo'
import { LeagueRepo } from '../backend/src/lib/repo'

const SeedSchema = z.object({
  league: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    tagline: z.string().optional(),
    settings: LeagueSettingsSchema,
  }),
  season: z.object({
    id: z.string().min(1),
    year: z.number().int(),
    label: z.string().min(1),
    startWeek: z.number().int().default(1),
    endWeek: z.number().int().default(18),
    status: z.enum(['upcoming', 'active', 'complete']).default('active'),
  }),
  members: z
    .array(
      z.object({
        displayName: z.string().min(1),
        email: z.email(),
        role: MembershipRoleSchema.default('player'),
        nickname: z.string().optional(),
        playerId: z.string().optional(),
      }),
    )
    .min(1),
})

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const file = process.argv[2]
if (!file) {
  console.error('usage: npm run api:seed -- <seed.json>')
  process.exit(2)
}
const tableName = process.env.TABLE_NAME
if (!tableName) {
  console.error('TABLE_NAME is required (see stack outputs)')
  process.exit(2)
}

const seed = SeedSchema.parse(JSON.parse(readFileSync(resolve(process.cwd(), file), 'utf8')))
const repo = new LeagueRepo(new DynamoStore(tableName))
const now = new Date().toISOString()

await repo.putLeague({
  id: seed.league.id,
  name: seed.league.name,
  tagline: seed.league.tagline,
  createdAt: now,
  settings: seed.league.settings,
  currentSeasonId: seed.season.id,
})
await repo.putSeason({ ...seed.season, leagueId: seed.league.id, isSynthetic: false })
for (const m of seed.members) {
  const playerId = m.playerId ?? slugify(m.displayName)
  const existing = await repo.getProfile(playerId)
  await repo.putProfile({
    playerId,
    displayName: m.displayName,
    nickname: m.nickname,
    imageId: existing?.imageId ?? null,
    email: m.email.toLowerCase(),
  })
  const membership = await repo.getMembership(seed.league.id, seed.season.id, playerId)
  await repo.putMembership(
    membership ?? {
      id: `m-${playerId}`,
      leagueId: seed.league.id,
      seasonId: seed.season.id,
      playerId,
      role: m.role,
      status: 'active',
      joinedAt: now,
    },
  )
  console.log(`member ${playerId} (${m.role}) ready`)
}
console.log(`seeded league '${seed.league.id}' season '${seed.season.id}' in table ${tableName}`)
console.log('Next: create the Cognito users (same emails) — see infra/README.md.')
