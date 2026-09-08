#!/usr/bin/env bash
# init.sh — Deterministic Bootstrap (Pillar 1)
#
# Zero → running demo-mode dev server in one command. Idempotent, loud on
# failure, no manual steps. The agent's first action in any session is
#   bash init.sh
# If it fails, fixing it IS the task.
#
#   bash init.sh               install deps, install hooks, start the Vite dev
#                              server (demo mode) and wait for HTTP 200
#   bash init.sh --with-pages  additionally build the production bundle under
#                              /Survivor/ and serve it like GitHub Pages
#   bash init.sh --stop        symmetric teardown of everything it started

set -euo pipefail
IFS=$'\n\t'
cd "$(dirname "$0")"

PROJECT_NAME="NFL Survivor League"
# Distinctive ports from build/ports.json so several editors/apps can run side by side.
DEV_PORT="$(jq -r .dev build/ports.json)"
PAGES_PORT="$(jq -r .pages build/ports.json)"
PAGES_BASE="/Survivor/"
DEV_URL="http://localhost:${DEV_PORT}/"
PAGES_URL="http://localhost:${PAGES_PORT}${PAGES_BASE}"
HEALTH_TIMEOUT_SECS=60

log()  { printf "\033[1;34m[init]\033[0m %s\n" "$*"; }
ok()   { printf "\033[1;32m[ ok ]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[warn]\033[0m %s\n" "$*" >&2; }
die()  { printf "\033[1;31m[fail]\033[0m %s\n" "$*" >&2; exit 1; }

kill_port() {
  local port="$1" pids me
  pids="$(lsof -ti:"$port" 2>/dev/null || true)"
  [[ -z "$pids" ]] && return 0
  me="${USER:-$(id -un)}"
  # Only kill our OWN processes, and only ones that look like this project
  # (vite / serve-static). Another app on the port is reported, never killed.
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    local owner cmdline
    owner="$(ps -o user= -p "$pid" 2>/dev/null || true)"
    cmdline="$(ps -o command= -p "$pid" 2>/dev/null || true)"
    if [[ "$owner" == "$me" ]] && [[ "$cmdline" == *vite* || "$cmdline" == *serve-static* ]]; then
      log "Stopping stale $(basename "${cmdline%% *}") process on port $port (pid $pid)"
      kill "$pid" 2>/dev/null || true
    else
      warn "Port $port is used by another process (pid $pid: ${cmdline:0:60}). Change build/ports.json if this is not ours."
    fi
  done <<< "$pids"
  sleep 0.5
}

wait_for_url() {
  local url="$1" timeout="$2" elapsed=0
  log "Waiting for $url (timeout ${timeout}s)"
  while (( elapsed < timeout )); do
    if curl -fsS -o /dev/null "$url"; then
      ok "$url is up (HTTP 200)"
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  die "Timed out waiting for $url — see .logs/"
}

# ---------------------------------------------------------------------------
# --stop: symmetric teardown
# ---------------------------------------------------------------------------
if [[ "${1:-}" == "--stop" ]]; then
  log "Stopping $PROJECT_NAME"
  if [[ -d .pids ]]; then
    for pidfile in .pids/*.pid; do
      [[ -f "$pidfile" ]] || continue
      pid="$(cat "$pidfile")"
      if kill -0 "$pid" 2>/dev/null; then
        log "Stopping $(basename "$pidfile" .pid) (pid $pid)"
        kill "$pid" 2>/dev/null || true
      fi
      rm -f "$pidfile"
    done
  fi
  kill_port "$DEV_PORT"
  kill_port "$PAGES_PORT"
  ok "Stopped. Safe to re-run: bash init.sh"
  exit 0
fi

# ---------------------------------------------------------------------------
# 0. Pre-flight
# ---------------------------------------------------------------------------
log "Bootstrapping $PROJECT_NAME"
[[ "$(id -u)" == "0" ]] && die "Do not run init.sh as root."
[[ -n "${SUDO_USER:-}" ]] && die "Do not run init.sh with sudo."
command -v node >/dev/null 2>&1 || die "Node.js is required (see .nvmrc: $(cat .nvmrc))."
command -v jq >/dev/null 2>&1 || die "jq is required (brew install jq)."
node_major="$(node -p 'process.versions.node.split(".")[0]')"
(( node_major >= 22 )) || die "Node >= 22 required (found $(node --version)). Use: nvm use"

if [[ -f ".env.local" ]]; then
  ok "Found .env.local (loaded by Vite; never committed)"
else
  log "No .env.local — running in demo mode (copy .env.example to .env.local to change)."
fi

mkdir -p .logs .pids

# ---------------------------------------------------------------------------
# 1. Kill stale processes on our ports
# ---------------------------------------------------------------------------
kill_port "$DEV_PORT"
[[ "${1:-}" == "--with-pages" ]] && kill_port "$PAGES_PORT"

# ---------------------------------------------------------------------------
# 2. Dependencies (skip when lockfile is unchanged since last install)
# ---------------------------------------------------------------------------
stamp="node_modules/.install-stamp"
if [[ ! -d node_modules ]] || [[ ! -f "$stamp" ]] || [[ package-lock.json -nt "$stamp" ]]; then
  log "Installing dependencies (npm ci)"
  npm ci --no-audit --no-fund > .logs/npm-ci.log 2>&1 || die "npm ci failed — see .logs/npm-ci.log"
  touch "$stamp"
  ok "Dependencies installed"
else
  ok "Dependencies up to date"
fi

if ! npx playwright install chromium --dry-run >/dev/null 2>&1; then
  :
fi
if [[ ! -d "${PLAYWRIGHT_BROWSERS_PATH:-$HOME/Library/Caches/ms-playwright}" ]] && [[ ! -d "${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}" ]]; then
  log "Installing Playwright Chromium (one-time, needs network)"
  npx playwright install chromium > .logs/playwright-install.log 2>&1 && ok "Chromium ready" || warn "Chromium download failed — e2e tests unavailable until: npx playwright install chromium"
fi

# ---------------------------------------------------------------------------
# 3. Generated assets (demo fixtures + sample headshots) — regenerate if missing
# ---------------------------------------------------------------------------
if [[ ! -f src/data/demo/fixtures/demo-season.json ]]; then
  log "Generating demo fixtures"
  npm run -s fixtures:generate > .logs/fixtures.log 2>&1 || die "fixture generation failed — see .logs/fixtures.log"
fi
if [[ ! -f public/headshots/default.svg ]]; then
  log "Generating sample headshots"
  npm run -s headshots:generate > .logs/headshots.log 2>&1 || die "headshot generation failed"
fi
ok "Demo fixtures and headshots present"

# ---------------------------------------------------------------------------
# 4. Git hooks (the local guardrails)
# ---------------------------------------------------------------------------
if git rev-parse --git-dir >/dev/null 2>&1; then
  bash scripts/install-hooks.sh > .logs/hooks.log 2>&1 && ok "Git hooks installed" || warn "Could not install git hooks — see .logs/hooks.log"
fi

# ---------------------------------------------------------------------------
# 5. Start services
# ---------------------------------------------------------------------------
log "Starting Vite dev server (demo mode) on port $DEV_PORT"
nohup npx vite --port "$DEV_PORT" --strictPort > .logs/dev.log 2>&1 &
echo $! > .pids/dev.pid
wait_for_url "$DEV_URL" "$HEALTH_TIMEOUT_SECS"

if [[ "${1:-}" == "--with-pages" ]]; then
  log "Building production bundle under $PAGES_BASE (GitHub Pages parity)"
  npx vite build --base="$PAGES_BASE" --outDir dist-e2e > .logs/build.log 2>&1 || die "build failed — see .logs/build.log"
  nohup node scripts/serve-static.mjs --dir dist-e2e --base "$PAGES_BASE" --port "$PAGES_PORT" > .logs/pages.log 2>&1 &
  echo $! > .pids/pages.pid
  wait_for_url "$PAGES_URL" "$HEALTH_TIMEOUT_SECS"
fi

# ---------------------------------------------------------------------------
# 6. Report
# ---------------------------------------------------------------------------
ok "Bootstrap complete"
echo
echo "  Dev server (demo mode): $DEV_URL"
[[ "${1:-}" == "--with-pages" ]] && echo "  Pages-like preview:     $PAGES_URL"
echo "  Logs:                   ./.logs/"
echo "  PIDs:                   ./.pids/"
echo
echo "Next: bash agent-status.sh   (state)   ·   bash quality-sweep.sh   (drift)"
