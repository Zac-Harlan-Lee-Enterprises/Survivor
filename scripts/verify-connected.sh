#!/usr/bin/env bash
# verify-connected.sh — smoke-checks a deployed connected-mode backend.
#
#   VITE_API_BASE_URL=https://xxxx.execute-api.us-east-1.amazonaws.com bash scripts/verify-connected.sh
#   ... [--image]  additionally exercises the headshot upload flow; needs
#                  SURVIVOR_TOKEN (a commissioner's Cognito access token) and
#                  SURVIVOR_PLAYER_ID.
#
# Reads .env.local when present. Never prints tokens.
set -uo pipefail
cd "$(dirname "$0")/.."
if [[ -f .env.local ]]; then set -a; source .env.local; set +a; fi

api="${VITE_API_BASE_URL:-}"
[[ -z "$api" ]] && { echo "[fail] VITE_API_BASE_URL is not set (connected mode not configured)"; exit 1; }
api="${api%/}"

ok()   { printf "\033[1;32m[ ok ]\033[0m %s\n" "$*"; }
fail() { printf "\033[1;31m[fail]\033[0m %s\n" "$*" >&2; exit 1; }

teams=$(curl -fsS "$api/nfl/teams") || fail "GET $api/nfl/teams unreachable"
[[ "$(printf '%s' "$teams" | jq 'length')" == "32" ]] && ok "API serves 32 teams" || fail "unexpected /nfl/teams payload"
leagues=$(curl -fsS "$api/leagues") || fail "GET /leagues failed"
league_id=$(printf '%s' "$leagues" | jq -r '.[0].id // empty')
[[ -n "$league_id" ]] && ok "league '$league_id' exists" || fail "no league seeded — see infra/README.md (seed step)"
season_id=$(printf '%s' "$leagues" | jq -r '.[0].currentSeasonId')
curl -fsS "$api/seasons/$season_id/snapshot" | jq -e '.season.id' >/dev/null && ok "season snapshot loads (redacted, anonymous)" || fail "snapshot failed"

if [[ "${1:-}" == "--image" ]]; then
  : "${SURVIVOR_TOKEN:?set SURVIVOR_TOKEN to a commissioner access token}"
  : "${SURVIVOR_PLAYER_ID:?set SURVIVOR_PLAYER_ID}"
  ticket=$(curl -fsS -X POST "$api/players/$SURVIVOR_PLAYER_ID/image/upload-ticket" \
    -H "Authorization: Bearer $SURVIVOR_TOKEN" -H 'Content-Type: application/json' \
    -d '{"contentType":"image/png","sizeBytes":68}') || fail "upload-ticket refused"
  image_id=$(printf '%s' "$ticket" | jq -r .imageId)
  # 1x1 transparent PNG
  png=$(mktemp); printf 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' | base64 -d > "$png"
  for v in thumb medium; do
    url=$(printf '%s' "$ticket" | jq -r ".uploads.$v.url")
    args=()
    while IFS=$'\t' read -r k val; do args+=(-F "$k=$val"); done < <(printf '%s' "$ticket" | jq -r ".uploads.$v.fields | to_entries[] | [.key,.value] | @tsv")
    curl -fsS -o /dev/null "${args[@]}" -F "file=@$png;type=image/png" "$url" || fail "presigned POST for $v rejected"
  done
  curl -fsS -X POST "$api/players/$SURVIVOR_PLAYER_ID/image/finalize" \
    -H "Authorization: Bearer $SURVIVOR_TOKEN" -H 'Content-Type: application/json' \
    -d "{\"imageId\":\"$image_id\",\"contentType\":\"image/png\",\"sizeBytes\":68,\"width\":1,\"height\":1}" | jq -e '.id' >/dev/null \
    && ok "headshot uploaded and finalized ($image_id)" || fail "finalize failed"
  rm -f "$png"
fi
ok "connected mode looks healthy"
