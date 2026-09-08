# SECURITY.md

## Reporting a suspected leak or vulnerability

- **League commissioner / repo owner:** Zac Harlan (zacharyharlan@gmail.com) — open a private GitHub security advisory on this repository, or email directly.
- There is no on-call rotation; this is a small private league. Expect a same-week response.

## If a secret was committed

1. **Stop.** Do not push.
2. Rotate the credential at its source (AWS IAM / Cognito / the sports-data provider console).
3. If already pushed: rewrite is a human decision — coordinate with the repo owner; assume the value is public and rotate first.
4. Add the leak pattern to `SECRET_RE` in `scripts/lib/policy.sh` so the pre-commit hook and `quality-sweep.sh` catch it next time.

## What must never be in this repository

- AWS access keys, Cognito client secrets, sports-data API keys (`VITE_*` variables are compiled into the public GitHub Pages bundle).
- Player emails or headshot binaries. Emails live only in DynamoDB; images live only in S3 (records hold keys).
- `.env.local` (gitignored) — copy from `.env.example`.

## Data classification

- [x] Public — the demo site and its synthetic sample players.
- [x] Internal — league members' names, nicknames and headshots (connected mode, behind Cognito sign-in for writes; reads are public within the league site).
- [ ] Confidential / Restricted — none. **No betting, odds, spreads or money changes hands in this application, by design.**

## Sensitive paths

The authoritative, machine-read list is `SENSITIVE_PATH_PATTERNS` in `scripts/lib/policy.sh` (CI workflows, infra, the guardrails themselves). Agents must not modify those files without recorded human approval and a `SECURITY-REVIEW: <approver>` commit trailer — enforced by `scripts/hooks/commit-msg`.

## Agent-generated commits

- Each session entry in `claude-progress.txt` records the agent name and model version.
- Commits authored by an agent carry a `Co-Authored-By:` trailer for audit traceability.
