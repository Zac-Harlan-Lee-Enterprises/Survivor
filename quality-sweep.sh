#!/usr/bin/env bash
# quality-sweep.sh — Drift Detection (Pillar 4)
#
# Garbage-collection pass. Run regularly and in CI. Exits non-zero on any
# finding, so it can gate merges.

set -uo pipefail
IFS=$'\n\t'
cd "$(git rev-parse --show-toplevel 2>/dev/null || dirname "$0")"

EXIT=0
fail() { printf "\033[1;31m[fail]\033[0m %s\n" "$*" >&2; EXIT=1; }
warn() { printf "\033[1;33m[warn]\033[0m %s\n" "$*" >&2; }
ok()   { printf "\033[1;32m[ ok ]\033[0m %s\n" "$*"; }

# shellcheck disable=SC1091
if ! source scripts/lib/policy.sh 2>/dev/null; then
  fail "scripts/lib/policy.sh missing — policy values (secret patterns, sensitive paths) undefined"
fi

# ---------------------------------------------------------------------------
echo "── Architecture tests ─────────────────────────────────────────────"
# ---------------------------------------------------------------------------
if npx vitest run tests/architecture --reporter=dot >/dev/null 2>&1; then
  ok "architecture tests pass (tests/architecture/layers.test.ts)"
else
  fail "architecture tests FAILED → npx vitest run tests/architecture"
fi

# ---------------------------------------------------------------------------
echo "── Config integrity ───────────────────────────────────────────────"
# ---------------------------------------------------------------------------
for f in feature_list.json build/ports.json knip.json package.json tsconfig.json .claude/settings.json; do
  if [[ -f "$f" ]]; then
    jq empty "$f" >/dev/null 2>&1 && ok "$f is valid JSON" || fail "$f is invalid JSON"
  fi
done
if [[ -f feature_list.json ]]; then
  dupes=$(jq -r '[.[].id] | group_by(.) | map(select(length>1)) | flatten | unique | .[]' feature_list.json 2>/dev/null || true)
  [[ -n "$dupes" ]] && fail "feature_list.json has duplicate ids: $dupes"
  missing=$(jq -r '.[] | select((.verification|length)==0 or (.id|length)==0) | .id' feature_list.json)
  [[ -n "$missing" ]] && fail "feature_list.json entries without verification: $missing"
  # depends_on must reference existing ids
  bad_deps=$(jq -r '[.[].id] as $ids | .[] | select(.depends_on) | .depends_on[] | select(. as $d | $ids | index($d) | not)' feature_list.json)
  [[ -n "$bad_deps" ]] && fail "feature_list.json depends_on references unknown ids: $bad_deps"
fi
yamls=$(ls .github/workflows/*.yml infra/*.yaml 2>/dev/null || true)
if [[ -n "$yamls" ]]; then
  if node scripts/validate-yaml.mjs $yamls >/dev/null 2>&1; then ok "workflow + infra YAML parse"; else fail "YAML syntax error → node scripts/validate-yaml.mjs $yamls"; fi
fi
if jq -e '.season.isSynthetic == true' src/data/demo/fixtures/demo-season.json >/dev/null 2>&1; then
  ok "demo fixture is flagged synthetic (never mistaken for real NFL data)"
else
  fail "demo fixture must set season.isSynthetic=true"
fi

# ---------------------------------------------------------------------------
echo "── Registry re-verification (hermetic entries claiming passes:true) ─"
# ---------------------------------------------------------------------------
if [[ -f feature_list.json ]]; then
  while IFS=$'\t' read -r id verification; do
    [[ -z "$id" ]] && continue
    if bash -c "$verification" >/dev/null 2>&1; then
      ok "registry '$id' re-verified"
    else
      fail "registry '$id' claims passes:true but its verification now FAILS:"
      echo "      $verification" >&2
      echo "      → fix the regression, or flip passes to false" >&2
    fi
  done < <(jq -r '.[] | select(.passes==true and .hermetic==true) | [.id, .verification] | @tsv' feature_list.json 2>/dev/null)
fi

# ---------------------------------------------------------------------------
echo "── Debug artifacts in source ──────────────────────────────────────"
# ---------------------------------------------------------------------------
if grep -rnE '(console\.log\(|^\s*debugger\b)' --include='*.ts' --include='*.tsx' \
     --exclude='*.test.ts' --exclude='*.test.tsx' --exclude-dir=node_modules --exclude-dir=testing \
     src backend/src 2>/dev/null; then
  fail "Debug artifacts found in source (console.log / debugger)"
else
  ok "No debug artifacts in src/ or backend/src/"
fi
if grep -rnE '\b(it|describe|test)\.only\(' --include='*.test.ts' --include='*.test.tsx' --include='*.spec.ts' src backend tests 2>/dev/null; then
  fail "Focused tests (.only) left behind"
else
  ok "No focused tests"
fi

# ---------------------------------------------------------------------------
echo "── Documentation validity ─────────────────────────────────────────"
# ---------------------------------------------------------------------------
# Validity, NOT age: docs must point at things that exist.
check_doc_refs() {
  local doc="$1" broken=0
  [[ -f "$doc" ]] || { fail "$doc not found"; return; }
  while IFS= read -r ref; do
    [[ -z "$ref" ]] && continue
    case "$ref" in http*|*' '*|*'<'*|*'*'*|*'{'*|*'$'*|*'#'*|*'|'*|*'…'*|*'='*) continue ;; esac
    ref="${ref%%:*}"
    # Only tokens whose first segment is a real top-level entry are treated as
    # repo paths (so `owner/repo`, `refs/heads/main`, `actions/x` are ignored).
    first="${ref%%/*}"
    [[ -e "$first" ]] || continue
    if [[ ! -e "$ref" ]]; then
      fail "$doc references '$ref' — not found (renamed or deleted?)"
      broken=1
    fi
  done < <({ grep -oE '`[^`]+/[^`]+`' "$doc" | tr -d '`'; grep -oE 'bash [a-zA-Z0-9_./-]+\.sh' "$doc" | awk '{print $2}'; grep -oE '\]\((docs|infra|scripts|src|tests|backend|build)/[^)#]+' "$doc" | sed 's/^](//'; } 2>/dev/null | sort -u || true)
  (( broken == 0 )) && ok "$doc references all resolve"
}
check_doc_refs AGENTS.md
check_doc_refs README.md
for d in docs/*.md infra/README.md; do [[ -f "$d" ]] && check_doc_refs "$d"; done
# npm scripts named in docs must exist
if [[ -f AGENTS.md ]]; then
  while IFS= read -r script; do
    [[ -z "$script" ]] && continue
    jq -e --arg s "$script" '.scripts[$s]' package.json >/dev/null 2>&1 || fail "AGENTS.md mentions 'npm run $script' but package.json has no such script"
  done < <(grep -oE 'npm run [a-zA-Z0-9:_-]+' AGENTS.md README.md | awk '{print $3}' | sort -u)
fi

# ---------------------------------------------------------------------------
echo "── Secret scan ────────────────────────────────────────────────────"
# ---------------------------------------------------------------------------
if [[ -n "${SECRET_RE:-}" ]]; then
  if git grep -InE "$SECRET_RE" -- . ':!scripts/lib/policy.sh' 2>/dev/null | grep -v 'pragma: allowlist-secret'; then
    fail "Possible secret found in tracked files — investigate immediately"
  else
    ok "No obvious secret patterns in tracked files"
  fi
  # Untracked-but-present files matter too (a new file before its first commit).
  if git ls-files --others --exclude-standard | grep -vE '^(scripts/lib/policy\.sh)$' | xargs -r grep -InE "$SECRET_RE" 2>/dev/null | grep -v 'pragma: allowlist-secret'; then
    fail "Possible secret found in an untracked file"
  fi
else
  fail "SECRET_RE undefined (scripts/lib/policy.sh missing) — secret scan skipped"
fi
if git ls-files | grep -qE '^\.env(\.local|\..*\.local)?$'; then fail ".env/.env.local is tracked — remove it from git"; else ok "no .env files tracked"; fi

# ---------------------------------------------------------------------------
echo "── Action guardrails (Pillar 6) ───────────────────────────────────"
# ---------------------------------------------------------------------------
if [[ -f .claude/settings.json ]]; then
  jq -e '.permissions.deny | index("Bash(gh pr merge:*)")' .claude/settings.json >/dev/null 2>&1 && ok ".claude/settings.json denies PR merge" || fail ".claude/settings.json does not deny 'Bash(gh pr merge:*)'"
  jq -e '.permissions.ask | index("Bash(git push *)")' .claude/settings.json >/dev/null 2>&1 && ok "'git push' requires confirmation (survives auto mode)" || fail "No ask rule for 'Bash(git push *)'"
  jq -e '.permissions.deny | index("Bash(aws cloudformation delete-stack:*)")' .claude/settings.json >/dev/null 2>&1 && ok "AWS stack deletion denied" || fail "No deny rule for 'aws cloudformation delete-stack'"
else
  fail "No .claude/settings.json — agents run with no command-level guardrails"
fi

GUARD=scripts/hooks/guard-destructive-commands.sh
if [[ -x "$GUARD" ]]; then
  bash "$GUARD" --self-test >/dev/null 2>&1 && ok "PreToolUse guard self-test passes (blocks destructive, allows benign)" || fail "guard self-test FAILED → bash $GUARD --self-test"
  bash tests/guardrails/run.sh >/dev/null 2>&1 && ok "tests/guardrails/run.sh passes" || fail "tests/guardrails/run.sh FAILED"
else
  fail "$GUARD missing or not executable"
fi

if [[ -f .claude/settings.json ]] && [[ -n "${SENSITIVE_PATH_PATTERNS+x}" ]]; then
  rules=$(jq -r '((.permissions.ask // []) + (.permissions.deny // []))[] | select(startswith("Edit("))' .claude/settings.json)
  covered=1
  for pat in "${SENSITIVE_PATH_PATTERNS[@]}"; do
    frag=$(printf '%s' "$pat" | sed 's/^\^//; s/\$$//; s/\\//g; s:/$::; s/\.\*//g')
    if ! printf '%s\n' "$rules" | grep -qF "$frag"; then
      fail "sensitive path '$frag' (policy.sh) has no Edit rule in .claude/settings.json"
      covered=0
    fi
  done
  (( covered )) && ok "settings.json Edit rules cover every sensitive path in policy.sh"
fi

for h in commit-msg pre-push pre-commit; do
  if [[ -x ".git/hooks/$h" ]]; then ok "git hook installed: $h"; else fail "git hook NOT installed: $h → bash scripts/install-hooks.sh"; fi
done

if command -v gh >/dev/null 2>&1 && git remote get-url origin >/dev/null 2>&1; then
  slug=$(git remote get-url origin | sed -E 's#.*github\.com[:/]([^/]+/[^/.]+)(\.git)?#\1#')
  if ! prot=$(gh api "repos/$slug/branches/main/protection" 2>&1); then
    if printf '%s' "$prot" | grep -qiE 'upgrade|not available|403'; then
      warn "branch protection is not available on this plan for private repos — the server-side layer is missing"
    elif [[ -n "${CI:-}" ]]; then
      # CI's GITHUB_TOKEN usually cannot read protection settings; a red CI on a
      # brand-new repo would only teach people to ignore the sweep.
      warn "main protection could not be verified from CI (run harden-github.sh $slug, then bash quality-sweep.sh locally)"
    else
      fail "main is NOT protected on GitHub — the only unbypassable layer is missing → bash harden-github.sh $slug"
    fi
  elif ! printf '%s' "$prot" | jq -e '.enforce_admins.enabled == true' >/dev/null 2>&1; then
    fail "main is protected but enforce_admins is OFF — 'gh pr merge --admin' still works"
  else
    ok "main is protected and admins cannot bypass"
  fi
else
  warn "no GitHub remote yet — branch protection (Layer 3) cannot be checked. After pushing: bash harden-github.sh <owner>/<repo>"
fi

# ---------------------------------------------------------------------------
echo "── Dead exports (knip) ────────────────────────────────────────────"
# ---------------------------------------------------------------------------
if npx knip --no-progress >/dev/null 2>&1; then
  ok "knip: no unused files, exports or dependencies"
else
  fail "knip found unused code/dependencies → npx knip"
fi

echo
if (( EXIT == 0 )); then ok "Sweep clean."; else fail "Sweep found issues."; fi
exit "$EXIT"
