# infra/ — optional AWS backend

`template.yaml` is an AWS SAM template for connected mode. It is a **sensitive path**: changes need human review and a `SECURITY-REVIEW:` commit trailer, and deploying is a human action (`sam deploy` is blocked for agents by the guardrails).

Full walkthrough: [docs/aws-connected-mode.md](../docs/aws-connected-mode.md).

```bash
npm run api:build                       # backend/dist/{api,syncResults}/index.mjs
cd infra
sam validate --lint                     # agents may run this
sam build && sam deploy --guided        # humans only
```

Parameters: `SiteOrigin`, `SiteBasePath`, `CognitoDomainPrefix`, `DefaultLeagueId`, `NflProvider` (`manual` | `espn`), `SyncScheduleExpression`.

Outputs feed the site's repository variables (`VITE_API_BASE_URL`, `VITE_COGNITO_AUTHORITY`, `VITE_COGNITO_CLIENT_ID`, `VITE_IMAGE_BASE_URL`).

Seeding (`seed.example.json` → `npm run api:seed`) writes the league, season and members; Cognito users are created separately with the same emails.

The table and bucket are `Retain` on stack deletion so player data survives a mistaken teardown.
