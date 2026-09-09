#!/usr/bin/env bash
# agent-status.sh — Observable State (Pillar 4)
#
# Read-only orientation dump. Always exits 0 (status, not gating).
# No secrets are printed — env values are redacted to their last 4 chars.

set -uo pipefail
IFS=$'\n\t'
cd "$(dirname "$0")"

DEV_PORT="$(jq -r .dev build/ports.json 2>/dev/null || echo 5891)"
PAGES_PORT="$(jq -r .pages build/ports.json 2>/dev/null || echo 5892)"

hr() { printf '%.0s─' {1..70}; echo; }
section() { hr; printf "  %s\n" "$1"; hr; }

# ---------------------------------------------------------------------------
section "Services (ports from build/ports.json)"
# ---------------------------------------------------------------------------
for entry in "dev:$DEV_PORT:http://localhost:$DEV_PORT/" "pages:$PAGES_PORT:http://localhost:$PAGES_PORT/Survivor/"; do
  name="${entry%%:*}"; rest="${entry#*:}"; port="${rest%%:*}"; url="${rest#*:}"
  if pid="$(lsof -ti:"$port" 2>/dev/null | head -n1)" && [[ -n "$pid" ]]; then
    code="$(curl -s -o /dev/null -w '%{http_code}' "$url" || echo 000)"
    echo "  $name  port $port: UP   (pid $pid)  HTTP $code  $url"
  else
    echo "  $name  port $port: DOWN                     $url"
  fi
done

# ---------------------------------------------------------------------------
section "Runtime mode"
# ---------------------------------------------------------------------------
mode="demo"
if [[ -f .env.local ]] && grep -qE '^VITE_DATA_MODE=connected' .env.local; then mode="connected"; fi
echo "  VITE_DATA_MODE: $mode  ($( [[ -f .env.local ]] && echo '.env.local present' || echo 'no .env.local → demo defaults'))"
for key in VITE_API_BASE_URL VITE_COGNITO_AUTHORITY VITE_COGNITO_CLIENT_ID VITE_IMAGE_BASE_URL VITE_BASE_PATH; do
  val="$( [[ -f .env.local ]] && grep -E "^$key=" .env.local | head -1 | cut -d= -f2- || true )"
  if [[ -n "$val" ]]; then echo "  $key=…${val: -4}"; else echo "  $key=(unset)"; fi
done

# ---------------------------------------------------------------------------
section "Demo fixture"
# ---------------------------------------------------------------------------
if [[ -f src/data/demo/fixtures/demo-season.json ]]; then
  jq -r '"  season: \(.season.label)  players: \(.memberships|length)  picks: \(.picks|length)  games: \(.games|length)  finals: \([.games[]|select(.status=="final")]|length)"' src/data/demo/fixtures/demo-season.json
  jq -r '"  schedule: \([.weeks[].source]|unique|join(", "))  (isSynthetic=\(.season.isSynthetic))"' src/data/demo/fixtures/demo-season.json
  echo "  demo clock pinned at: $(grep -oE "DEMO_NOW = '[^']+'" src/data/demo/clock.ts | cut -d"'" -f2)"
else
  echo "  fixture missing → npm run fixtures:generate"
fi
echo "  headshots: $(ls public/headshots/*.svg 2>/dev/null | wc -l | tr -d ' ') files in public/headshots/"

# ---------------------------------------------------------------------------
section "Git"
# ---------------------------------------------------------------------------
if git rev-parse --git-dir >/dev/null 2>&1; then
  echo "  branch:      $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '(unborn)')"
  echo "  last commit: $(git log -1 --pretty=format:'%h %s (%ar)' 2>/dev/null || echo '(none yet)')"
  echo "  dirty files: $(git status --porcelain | wc -l | tr -d ' ')"
  for h in pre-commit commit-msg pre-push; do
    [[ -x ".git/hooks/$h" ]] && echo "  hook $h: installed" || echo "  hook $h: MISSING (bash scripts/install-hooks.sh)"
  done
else
  echo "  not a git repo"
fi

# ---------------------------------------------------------------------------
section "Feature registry"
# ---------------------------------------------------------------------------
if [[ -f feature_list.json ]]; then
  total=$(jq 'length' feature_list.json)
  pass=$(jq '[.[] | select(.passes==true)] | length' feature_list.json)
  fail=$(jq '[.[] | select(.passes==false)] | length' feature_list.json)
  echo "  total: $total   passing: $pass   failing: $fail"
  echo "  next up (lowest priority number, not passing):"
  jq -r '[.[] | select(.passes==false)] | sort_by(.priority) | .[0:5][] | "    \(.priority)  \(.id) — \(.description|.[0:70])"' feature_list.json
else
  echo "  feature_list.json not found"
fi

# ---------------------------------------------------------------------------
section "Build health (typecheck, ~10s)"
# ---------------------------------------------------------------------------
if [[ -d node_modules ]]; then
  if npm run -s typecheck >/dev/null 2>&1; then echo "  typecheck: PASS"; else echo "  typecheck: FAIL → npm run typecheck"; fi
  [[ -d dist ]] && echo "  dist/:     $(find dist -type f | wc -l | tr -d ' ') files (last build $(date -r dist '+%Y-%m-%d %H:%M'))" || echo "  dist/:     not built (npm run build)"
  [[ -d backend/dist ]] && echo "  api dist:  built" || echo "  api dist:  not built (npm run api:build)"
else
  echo "  node_modules missing → bash init.sh"
fi

hr
echo "Done."
