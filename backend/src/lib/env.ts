/**
 * Lambda environment. Values are set by infra/template.yaml. Secrets (a paid
 * NFL provider key) are NOT env vars: they are read from SSM at runtime by
 * the provider module, so they never appear in a deployment artifact.
 */
export interface BackendEnv {
  tableName: string
  imagesBucket: string
  imagesBaseUrl: string
  imagesRegion: string
  defaultLeagueId: string
  nflProvider: 'espn' | 'manual'
  nflProviderSecretParam: string | null
}

export function readEnv(source: NodeJS.ProcessEnv = process.env): BackendEnv {
  const provider = source.NFL_PROVIDER === 'espn' ? 'espn' : 'manual'
  return {
    tableName: source.TABLE_NAME ?? 'survivor',
    imagesBucket: source.IMAGES_BUCKET ?? '',
    imagesBaseUrl: (source.IMAGES_BASE_URL ?? '').replace(/\/+$/, ''),
    imagesRegion: source.AWS_REGION ?? 'us-east-1',
    defaultLeagueId: source.DEFAULT_LEAGUE_ID ?? 'league',
    nflProvider: provider,
    nflProviderSecretParam: source.NFL_PROVIDER_SECRET_PARAM || null,
  }
}
