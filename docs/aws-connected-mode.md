# Connected mode (AWS)

Connected mode keeps the exact same static frontend on GitHub Pages and points it at an external HTTPS API. Nothing about the hosting changes.

## What gets created (`infra/template.yaml`, AWS SAM)

| Resource | Purpose | Cost note |
|----------|---------|-----------|
| DynamoDB table (on-demand, PITR) | leagues, seasons, members, profiles, picks, games, overrides, audit | pennies |
| S3 bucket | headshot objects under `images/…`; public **read** of that prefix only; uploads only via presigned POST | pennies |
| Cognito user pool + Hosted UI domain + public app client | sign-in (Authorization Code + PKCE, no secret); admin-created users only | free tier |
| HTTP API + JWT authorizer | `/{proxy+}` requires a Cognito JWT; `/public/{proxy+}` anonymous GETs | free tier |
| `ApiFunction` (Node 22, arm64) | all routes (`backend/src/handlers/api.ts`) | free tier |
| `SyncFunction` + EventBridge Scheduler | results sync when `NflProvider != manual` | free tier |

## Deploy (human-run — agents are blocked from `sam deploy`)

```bash
npm run api:build                                   # bundles backend/dist/*
cp infra/samconfig.example.toml infra/samconfig.toml # fill in SiteOrigin, CognitoDomainPrefix…
cd infra && sam validate --lint && sam build && sam deploy
```

Note the stack outputs: `ApiUrl`, `CognitoAuthority`, `CognitoClientId`, `ImagesBaseUrl`, `TableName`.

## Seed the league

```bash
cp infra/seed.example.json infra/seed.json          # your league, season, members (emails!)
TABLE_NAME=<TableName> AWS_REGION=<region> npm run api:seed -- infra/seed.json
```

Then create each member as a Cognito user with the **same email** (Console → User pool → Create user, or `aws cognito-idp admin-create-user`). On first sign-in the API links the Cognito identity to the player by email and stores the link.

## Point the site at the API

Set repository **variables** (Settings → Secrets and variables → Actions → Variables):

| Variable | Value |
|----------|-------|
| `VITE_DATA_MODE` | `connected` |
| `VITE_API_BASE_URL` | `ApiUrl` output |
| `VITE_COGNITO_AUTHORITY` | `CognitoAuthority` output |
| `VITE_COGNITO_CLIENT_ID` | `CognitoClientId` output |
| `VITE_IMAGE_BASE_URL` | `ImagesBaseUrl` output |
| `VITE_DEFAULT_LEAGUE_ID` | the league id from your seed |

Push to `main` (or re-run the Pages workflow). For local development put the same values in `.env.local`; `http://localhost:5891/` is pre-registered as a callback URL.

## Verify

```bash
VITE_API_BASE_URL=<ApiUrl> bash scripts/verify-connected.sh            # public reads
SURVIVOR_TOKEN=<access token> SURVIVOR_PLAYER_ID=<id> bash scripts/verify-connected.sh --image   # headshot round-trip
```

Registry entries `connected-mode-deployed` and `connected-image-upload-real` use these.

## Security properties

- **No secrets in the browser.** The app client has no secret; tokens are the user's own. Provider keys live in SSM (read by the Lambda).
- **Rules enforced server-side.** `PUT /seasons/{id}/picks/{week}` re-runs `validatePick` with the server clock and writes conditionally on the pick version; commissioner routes check the membership role in DynamoDB.
- **Redaction server-side.** The snapshot the API returns already hides other players' unlocked picks; player emails never leave the API.
- **Uploads are policy-bound.** Presigned POSTs pin key, content type and size; `finalize` HEADs the objects and deletes anything that does not match.
- **Idempotent, versioned results.** Duplicate sync runs are harmless; commissioner results are locked.

## Operations

- Logs: CloudWatch log groups for both functions (`aws logs tail /aws/lambda/<stack>-ApiFunction-… --since 1h`).
- Manual results / schedules: Commissioner → Results (works even with `NflProvider=manual`).
- Rotating a compromised value: rotate at the source, redeploy; see `SECURITY.md`.
- Multiple leagues later: the data model is already league-scoped (`LEAGUE#<id>` partitions, `currentSeasonId`); the frontend opens `VITE_DEFAULT_LEAGUE_ID` today and can grow a league switcher without schema changes.
