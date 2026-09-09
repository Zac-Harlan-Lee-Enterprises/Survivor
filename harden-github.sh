#!/usr/bin/env bash
# harden-github.sh — Layer 3 of 3: server-side guardrails.
#
# This is the only layer an agent (or a developer in a hurry) cannot bypass.
# Layers 1 and 2 live in files on the developer's laptop; anyone can edit them,
# and `--dangerously-skip-permissions` turns Layer 1 off entirely. GitHub does
# not care what runs locally — if `main` requires a review, `gh pr merge` fails
# at the API, full stop.
#
# Treat Layers 1 and 2 as fast feedback that keeps agents out of trouble, and
# THIS as the control you actually rely on.
#
# Usage:
#   bash harden-github.sh <owner>/<repo>            # apply
#   bash harden-github.sh <owner>/<repo> --dry-run  # show what would change
#
# Requires: gh CLI, authenticated with admin rights on the repo.

set -uo pipefail

# Run from the repo root regardless of the caller's working directory — the
# preflight below reads .github/workflows/, and a relative read that silently
# misses would skip the merge-lock check entirely.
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && git rev-parse --show-toplevel 2>/dev/null || dirname "${BASH_SOURCE[0]}")" || {
  echo "[fail] Could not resolve the repository root." >&2; exit 1; }

REPO="${1:-}"
DRY_RUN=false
[[ "${2:-}" == "--dry-run" ]] && DRY_RUN=true

if [[ -z "$REPO" ]]; then
  echo "usage: bash harden-github.sh <owner>/<repo> [--dry-run]" >&2
  exit 1
fi

# TUNE THESE before running.
REQUIRED_CHECK="build-and-test"   # must match the job name in .github/workflows/ci.yml exactly
REQUIRED_REVIEWS=1
DEFAULT_BRANCH="main"

say()  { printf "\033[36m[harden]\033[0m %s\n" "$*"; }
ok()   { printf "\033[32m[ ok ]\033[0m %s\n" "$*"; }
warn() { printf "\033[33m[warn]\033[0m %s\n" "$*"; }

# apply <ok-message> <warn-message> <cmd...>
# In dry-run: PRINT the command — never the success message. The old pattern
# `run gh api ... >/dev/null 2>&1 && ok "applied"` swallowed the dry-run
# preview into the redirect and then printed "[ ok ] applied" for actions that
# never ran — the admin either believed the settings were already in place or
# approved a change set they were never shown.
apply() {
  local okmsg="$1" warnmsg="$2"; shift 2
  if $DRY_RUN; then
    printf "\033[90m  would run: %s\033[0m\n" "$*"
  else
    if "$@" >/dev/null 2>&1; then ok "$okmsg"; else warn "$warnmsg"; fi
  fi
}

command -v gh >/dev/null 2>&1 || { echo "gh CLI not found" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "gh not authenticated — run: gh auth login" >&2; exit 1; }

say "Target: $REPO (branch: $DEFAULT_BRANCH)"
$DRY_RUN && warn "DRY RUN — nothing will be changed"

# ---------------------------------------------------------------------------
say "0/4  Preflight: the required check must be able to report on PRs"
# ---------------------------------------------------------------------------
# Requiring a status check that never runs on pull_request events MERGE-LOCKS
# the repo: every PR waits forever on "Expected", and enforce_admins removes
# the --admin escape — there is no path to main left. Refuse to proceed unless
# some workflow in this repo has a pull_request trigger.
if compgen -G ".github/workflows/*.y*ml" >/dev/null 2>&1; then
  if ! grep -lqE '^[[:space:]]*pull_request(_target)?:' .github/workflows/*.y*ml 2>/dev/null; then
    echo "[fail] No workflow in .github/workflows/ has a pull_request trigger." >&2
    echo "       Requiring the '$REQUIRED_CHECK' check would merge-lock every PR." >&2
    echo "       Add 'pull_request:' to the workflow that produces '$REQUIRED_CHECK' first," >&2
    echo "       and confirm the job name matches REQUIRED_CHECK exactly." >&2
    exit 1
  fi
  ok "a workflow runs on pull_request — confirm it produces the '$REQUIRED_CHECK' job"
else
  # Cannot verify — never treat that as a pass. Applying protection blind is
  # exactly how a repo ends up merge-locked with no admin escape.
  echo "[fail] No .github/workflows/ found (looked in $PWD)." >&2
  echo "       Cannot verify that '$REQUIRED_CHECK' reports on PRs. Run this from a checkout," >&2
  echo "       or set REQUIRED_CHECK to a check you have confirmed runs on pull_request." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
say "1/4  Branch protection on '$DEFAULT_BRANCH'"
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# enforce_admins:true is the load-bearing field. Without it, anyone with admin
# (which on most small teams is everyone) can `gh pr merge --admin` straight
# through every rule below, and agents WILL find that flag.
protection=$(cat <<JSON
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["$REQUIRED_CHECK"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": $REQUIRED_REVIEWS,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "require_last_push_approval": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "required_linear_history": false,
  "lock_branch": false,
  "allow_fork_syncing": false
}
JSON
)

if $DRY_RUN; then
  printf "\033[90m  would PUT repos/%s/branches/%s/protection:\033[0m\n%s\n" \
    "$REPO" "$DEFAULT_BRANCH" "$protection"
else
  if printf '%s' "$protection" | gh api -X PUT \
       "repos/$REPO/branches/$DEFAULT_BRANCH/protection" \
       -H "Accept: application/vnd.github+json" --input - >/dev/null 2>&1; then
    ok "Branch protection applied (reviews: $REQUIRED_REVIEWS, admins included, force-push off)"
  else
    warn "Failed. Needs admin rights; on private repos this needs GitHub Team/Enterprise."
  fi
fi

# `require_last_push_approval` is the specific setting that stops the most
# common agent accident: agent opens PR, human approves, agent pushes three
# more commits, agent merges. With it on, the new commits void the approval.

# ---------------------------------------------------------------------------
say "2/4  Deployment environments with required reviewers"
# ---------------------------------------------------------------------------
# A GitHub Environment with required reviewers means a deploy job PAUSES and
# waits for a human click. This is what makes "agent accidentally deployed to
# production" structurally impossible rather than merely discouraged.
for env in staging production; do
  reviewers_note=""
  if [[ "$env" == "production" ]]; then
    reviewers_note=" (add required reviewers in the UI — see note below)"
  fi
  apply "Environment '$env' exists$reviewers_note" \
        "Could not create environment '$env'" \
        gh api -X PUT "repos/$REPO/environments/$env" \
          -H "Accept: application/vnd.github+json"
done

cat <<'NOTE'

  ACTION REQUIRED (cannot be fully scripted):
    Settings → Environments → production → Deployment protection rules
      [x] Required reviewers      → add 1-2 humans (NOT a bot account)
      [x] Wait timer              → 5 minutes (gives you time to cancel)
      [x] Deployment branches     → Selected branches → main only
    Then move every production secret from repo secrets to THIS environment.
    Repo-level secrets are readable by any workflow on any branch, which means
    a PR from a feature branch can exfiltrate them.

NOTE

# ---------------------------------------------------------------------------
say "3/4  Repository-level settings"
# ---------------------------------------------------------------------------
# allow_auto_merge=false matters more than it looks: with auto-merge on, an
# agent can queue a merge that fires later with no human present.
apply "auto-merge disabled, branch cleanup on" \
      "Could not update repo settings" \
      gh api -X PATCH "repos/$REPO" \
        -F allow_auto_merge=false \
        -F delete_branch_on_merge=true \
        -F allow_update_branch=true

apply "GITHUB_TOKEN scoped read-only; workflows cannot approve PRs" \
      "Could not restrict workflow permissions" \
      gh api -X PUT "repos/$REPO/actions/permissions/workflow" \
        -f default_workflow_permissions=read \
        -F can_approve_pull_request_reviews=false

# ---------------------------------------------------------------------------
say "4/4  Secret scanning and push protection"
# ---------------------------------------------------------------------------
apply "Secret scanning + push protection enabled" \
      "Not available (needs GitHub Advanced Security on private repos)" \
      gh api -X PATCH "repos/$REPO" \
        -f 'security_and_analysis[secret_scanning][status]=enabled' \
        -f 'security_and_analysis[secret_scanning_push_protection][status]=enabled'

echo
say "Verify with:"
echo "  gh api repos/$REPO/branches/$DEFAULT_BRANCH/protection | jq '{admins:.enforce_admins.enabled, reviews:.required_pull_request_reviews.required_approving_review_count, force:.allow_force_pushes.enabled}'"
echo
say "Then confirm the gate actually bites — this MUST fail:"
echo "  git switch $DEFAULT_BRANCH && git commit --allow-empty -m test && git push"
