import type { NFLTeam } from './models'

type TeamSeed = [
  id: string,
  location: string,
  name: string,
  conference: 'AFC' | 'NFC',
  division: 'East' | 'North' | 'South' | 'West',
  primary: string,
  secondary: string,
  aliases: string[],
]

// Facts about the 32 franchises (abbreviations, cities, nicknames, divisions
// and approximate brand colours). No league or team logo assets are bundled —
// the UI renders monograms in team colours instead.
const SEED: TeamSeed[] = [
  ['ARI', 'Arizona', 'Cardinals', 'NFC', 'West', '#97233F', '#FFB612', ['ARZ', 'Cards']],
  ['ATL', 'Atlanta', 'Falcons', 'NFC', 'South', '#A71930', '#000000', []],
  ['BAL', 'Baltimore', 'Ravens', 'AFC', 'North', '#241773', '#9E7C0C', []],
  ['BUF', 'Buffalo', 'Bills', 'AFC', 'East', '#00338D', '#C60C30', []],
  ['CAR', 'Carolina', 'Panthers', 'NFC', 'South', '#0085CA', '#101820', []],
  ['CHI', 'Chicago', 'Bears', 'NFC', 'North', '#0B162A', '#C83803', []],
  ['CIN', 'Cincinnati', 'Bengals', 'AFC', 'North', '#FB4F14', '#000000', []],
  ['CLE', 'Cleveland', 'Browns', 'AFC', 'North', '#311D00', '#FF3C00', []],
  ['DAL', 'Dallas', 'Cowboys', 'NFC', 'East', '#041E42', '#869397', ['Boys']],
  ['DEN', 'Denver', 'Broncos', 'AFC', 'West', '#FB4F14', '#002244', []],
  ['DET', 'Detroit', 'Lions', 'NFC', 'North', '#0076B6', '#B0B7BC', []],
  ['GB', 'Green Bay', 'Packers', 'NFC', 'North', '#203731', '#FFB612', ['GNB', 'Pack']],
  ['HOU', 'Houston', 'Texans', 'AFC', 'South', '#03202F', '#A71930', []],
  ['IND', 'Indianapolis', 'Colts', 'AFC', 'South', '#002C5F', '#A2AAAD', ['Indy']],
  ['JAX', 'Jacksonville', 'Jaguars', 'AFC', 'South', '#006778', '#D7A22A', ['JAC', 'Jags']],
  ['KC', 'Kansas City', 'Chiefs', 'AFC', 'West', '#E31837', '#FFB81C', ['KAN']],
  ['LV', 'Las Vegas', 'Raiders', 'AFC', 'West', '#000000', '#A5ACAF', ['LVR', 'Vegas']],
  ['LAC', 'Los Angeles', 'Chargers', 'AFC', 'West', '#0080C6', '#FFC20E', ['Bolts']],
  ['LAR', 'Los Angeles', 'Rams', 'NFC', 'West', '#003594', '#FFA300', ['LA']],
  ['MIA', 'Miami', 'Dolphins', 'AFC', 'East', '#008E97', '#FC4C02', ['Fins']],
  ['MIN', 'Minnesota', 'Vikings', 'NFC', 'North', '#4F2683', '#FFC62F', ['Vikes']],
  ['NE', 'New England', 'Patriots', 'AFC', 'East', '#002244', '#C60C30', ['NWE', 'Pats']],
  ['NO', 'New Orleans', 'Saints', 'NFC', 'South', '#D3BC8D', '#101820', ['NOR']],
  ['NYG', 'New York', 'Giants', 'NFC', 'East', '#0B2265', '#A71930', ['G-Men']],
  ['NYJ', 'New York', 'Jets', 'AFC', 'East', '#125740', '#000000', []],
  ['PHI', 'Philadelphia', 'Eagles', 'NFC', 'East', '#004C54', '#A5ACAD', ['Philly']],
  ['PIT', 'Pittsburgh', 'Steelers', 'AFC', 'North', '#FFB612', '#101820', []],
  ['SF', 'San Francisco', '49ers', 'NFC', 'West', '#AA0000', '#B3995D', ['SFO', 'Niners']],
  ['SEA', 'Seattle', 'Seahawks', 'NFC', 'West', '#002244', '#69BE28', ['Hawks']],
  ['TB', 'Tampa Bay', 'Buccaneers', 'NFC', 'South', '#D50A0D', '#FF7900', ['TAM', 'Bucs']],
  ['TEN', 'Tennessee', 'Titans', 'AFC', 'South', '#0C2340', '#4B92DB', []],
  ['WAS', 'Washington', 'Commanders', 'NFC', 'East', '#5A1414', '#FFB612', ['WSH', 'Commies']],
]

export const NFL_TEAMS: readonly NFLTeam[] = SEED.map(
  ([id, location, name, conference, division, primary, secondary, aliases]) => ({
    id,
    abbreviation: id,
    location,
    name,
    fullName: `${location} ${name}`,
    conference,
    division,
    colors: { primary, secondary },
    aliases,
  }),
)

const TEAM_BY_ID: ReadonlyMap<string, NFLTeam> = new Map(NFL_TEAMS.map((t) => [t.id, t]))

export function getTeam(teamId: string): NFLTeam | undefined {
  return TEAM_BY_ID.get(teamId.toUpperCase())
}

export function requireTeam(teamId: string): NFLTeam {
  const team = getTeam(teamId)
  if (!team) throw new Error(`Unknown NFL team id: ${teamId}`)
  return team
}

export function isTeamId(value: string): boolean {
  return TEAM_BY_ID.has(value.toUpperCase())
}

export const ALL_TEAM_IDS: readonly string[] = NFL_TEAMS.map((t) => t.id)

function normalizeToken(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Every lookup key (id, nickname, city, full name, alias) → team id. */
const ALIAS_INDEX: ReadonlyMap<string, string[]> = (() => {
  const index = new Map<string, Set<string>>()
  const add = (key: string, id: string) => {
    const k = normalizeToken(key)
    if (!k) return
    const set = index.get(k) ?? new Set<string>()
    set.add(id)
    index.set(k, set)
  }
  for (const team of NFL_TEAMS) {
    add(team.id, team.id)
    add(team.name, team.id)
    add(team.location, team.id)
    add(team.fullName, team.id)
    for (const alias of team.aliases) add(alias, team.id)
  }
  return new Map([...index.entries()].map(([k, v]) => [k, [...v].sort()]))
})()

export type TeamLookup =
  | { kind: 'match'; teamId: string }
  | { kind: 'ambiguous'; candidates: string[] }
  | { kind: 'unknown' }

/**
 * Resolves free text ("Packers", "GB", "Green Bay", "gnb") to a team id.
 * "Los Angeles" and "New York" are ambiguous on their own and are reported as
 * such rather than guessed — import data must never be silently invented.
 */
export function lookupTeam(raw: string): TeamLookup {
  const key = normalizeToken(raw)
  if (!key) return { kind: 'unknown' }
  const ids = ALIAS_INDEX.get(key)
  if (!ids || ids.length === 0) return { kind: 'unknown' }
  if (ids.length === 1) return { kind: 'match', teamId: ids[0]! }
  return { kind: 'ambiguous', candidates: ids }
}

/** Relative luminance check so text stays readable on any team colour. */
export function readableTextColor(hex: string): '#ffffff' | '#0b1020' {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16) / 255
  const g = parseInt(value.slice(2, 4), 16) / 255
  const b = parseInt(value.slice(4, 6), 16) / 255
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  return luminance > 0.35 ? '#0b1020' : '#ffffff'
}
