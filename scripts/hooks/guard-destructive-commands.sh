#!/usr/bin/env bash
# guard-destructive-commands.sh — Claude Code PreToolUse hook (Layer 2 of 3).
#
# Why this exists even though .claude/settings.json already has a deny list:
# deny rules are PREFIX matches against the command string. They do not see
# inside compound commands. All of these slip past a `Bash(gh pr merge:*)` rule:
#
#     cd /repo && gh pr merge 42 --admin
#     bash -c "gh pr merge 42"
#     gh api -X PUT repos/o/r/pulls/42/merge
#
# This hook regex-scans the WHOLE command string, so placement and chaining do
# not matter.
#
# HARD-WON RULES OF THIS FILE (each fixed a real bug — keep them):
#   * Any regex containing & ; | must live in a VARIABLE. Unquoted, those
#     characters are bash syntax errors inside [[ =~ ]] — and a guard that
#     dies with a syntax error exits 2, silently blocking EVERY command.
#   * Match branch names by exact TOKEN, never by substring: a suffix match
#     blocks legitimate branches like docs/update-main.
#   * Strip quoted strings before flag/keyword rules, so commit-message TEXT
#     ("document the -n flag", "--admin") can never trip a rule.
#   * Normalize whitespace with tr, not sed: BSD sed treats '\+' as a literal
#     plus, making 's/[[:space:]]\+/ /g' a silent no-op on macOS.
#
# Self-test (run it from quality-sweep.sh and the feature registry):
#   bash scripts/hooks/guard-destructive-commands.sh --self-test
# It asserts both directions: destructive commands BLOCK, benign look-alikes
# ALLOW (regressions for past false positives). Extend it with every rule you
# add or loosen.
#
# Contract: exit 0 = allow, exit 2 = BLOCK (stderr is shown to the agent),
# any other exit = non-blocking error. Never exit 1 from the hook path.

set -uo pipefail

# Shared policy values; safe fallback if the lib is missing.
_LIB="$(git rev-parse --show-toplevel 2>/dev/null || echo .)/scripts/lib/policy.sh"
# shellcheck disable=SC1090
[[ -f "$_LIB" ]] && source "$_LIB"
: "${PROTECTED_BRANCHES_RE:=(main|master|trunk|develop|release(/[^[:space:]]*)?|prod|production)}"

# --------------------------------------------------------------------------
# --self-test
# --------------------------------------------------------------------------
if [[ "${1:-}" == "--self-test" ]]; then
  self="${BASH_SOURCE[0]}"
  rc=0
  probe() {  # probe <expect: block|allow> <command string>
    local expect="$1" cmd="$2" got payload esc
    # jq encodes quotes/backslashes correctly; naive printf would produce
    # invalid JSON for commands containing '"' — the hook would then extract
    # an empty command and every "block" probe would falsely report a pass.
    payload=""
    if command -v jq >/dev/null 2>&1; then
      payload=$(jq -n --arg c "$cmd" '{tool_input:{command:$c}}' 2>/dev/null) || payload=""
    fi
    if [[ -z "$payload" ]]; then
      esc=${cmd//\\/\\\\}
      esc=${esc//\"/\\\"}
      payload=$(printf '{"tool_input":{"command":"%s"}}' "$esc")
    fi
    if printf '%s' "$payload" | bash "$self" >/dev/null 2>&1; then
      got="allow"
    else
      got="block"
    fi
    if [[ "$got" == "$expect" ]]; then
      printf '[self-test]   ok (%s): %s\n' "$expect" "$cmd"
    else
      printf '[self-test] FAIL (want %s, got %s): %s\n' "$expect" "$got" "$cmd" >&2
      rc=1
    fi
  }
  # Must block:
  probe block 'cd /tmp && gh pr merge 1'
  probe block 'gh pr review 7 --approve'
  probe block 'git push origin main'
  probe block 'git push origin HEAD:main'
  probe block 'git push origin +feature'
  probe block 'git push --force origin feat/x'
  probe block 'gh api -X PATCH repos/o/r -f allow_auto_merge=true'
  probe block 'gh api --method PUT repos/o/r/branches/main/protection'
  probe block 'git commit -n -m msg'
  probe block 'git commit --no-verify -m msg'
  probe block 'gh pr merge 42 --admin'
  probe block 'terraform apply -auto-approve'
  probe block 'gh workflow run deploy.yml'
  probe block "bash -c 'gh pr merge 42'"
  probe block 'sh -c "git push --force origin main"'
  probe block 'eval "gh pr review 7 --approve"'
  probe block 'sam deploy --guided'
  probe block 'sam delete --stack-name survivor'
  probe block 'aws cloudformation delete-stack --stack-name survivor'
  probe block 'aws s3 rm s3://survivor-images --recursive'
  probe block 'aws s3 sync dist/ s3://survivor-site'
  probe block 'aws dynamodb delete-table --table-name survivor'
  probe block 'aws lambda update-function-code --function-name api --zip-file fileb://x.zip'
  # Must allow (regressions for past false positives):
  probe allow 'git commit -m fix && git log --oneline -n 5'
  probe allow 'git commit -m "document the -n flag"'
  probe allow 'git push -u origin docs/remain'
  probe allow 'git push origin feature/main-page'
  probe allow 'gh api repos/o/r/pulls/42'
  probe allow 'grep -rn -- --no-verify docs/'
  probe allow 'echo x | grep -n foo'
  probe allow 'terraform plan'
  probe allow 'sam build'
  probe allow 'sam validate --lint'
  probe allow 'aws sts get-caller-identity'
  probe allow 'aws s3 ls'
  probe allow 'aws dynamodb describe-table --table-name survivor'
  probe allow 'aws logs tail /aws/lambda/survivor-api --since 1h'
  exit "$rc"
fi

payload=$(cat)

# Extract the command without requiring jq (jq is not on every Windows dev box).
# NEVER trust `command -v jq` alone: a jq that EXISTS but fails (broken install,
# wrong arch) returns an empty string, which under the old `[[ -z "$cmd" ]] &&
# exit 0` meant "no command, allow" — silently disabling every rule below while
# every existence check still passed. Verify we actually got output, and fail
# CLOSED when a payload plainly carries a command we could not parse.
cmd=""
if command -v jq >/dev/null 2>&1; then
  cmd=$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null) || cmd=""
fi
if [[ -z "$cmd" ]]; then
  cmd=$(printf '%s' "$payload" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p')
  # Undo JSON string escaping that jq would have handled for us.
  cmd=${cmd//\\\"/\"}
  cmd=${cmd//\\\\/\\}
fi

if [[ -z "$cmd" ]]; then
  if printf '%s' "$payload" | grep -q '"command"'; then
    echo "BLOCKED: guard could not parse the command out of the tool payload." >&2
    echo "  Refusing to allow an unverified command. Check jq and this hook." >&2
    exit 2
  fi
  exit 0
fi

# Normalize: strip line continuations, collapse whitespace runs (tr — see
# header). noq additionally strips quoted strings for flag/keyword rules.
norm=$(printf '%s' "$cmd" | sed 's/\\ / /g' | tr '\n' ' ' | tr -s '[:space:]' ' ')
noq=$(printf '%s' "$norm" | sed "s/\"[^\"]*\"//g; s/'[^']*'//g")
# Shell wrappers (bash -c '…', sh -c "…", eval "…") make the QUOTED text the
# command. Stripping quotes there would blind every rule below, so for wrapped
# commands the rules run on the full string instead.
re_wrapper='(^|[[:space:]&;|(])(bash|sh|zsh|dash|ksh|eval|source|exec)[[:space:]]+(-[a-zA-Z]+[[:space:]]+)*["'"'"']'
if [[ "$norm" =~ $re_wrapper ]]; then
  noq="$norm"
fi

block() {
  cat >&2 <<EOF
BLOCKED by scripts/hooks/guard-destructive-commands.sh

  Command : $cmd
  Rule    : $1
  Why     : $2

This is a human-only action. Do not attempt to work around it — do not retry
with different syntax, do not edit this hook, do not edit .claude/settings.json.

What to do instead:
  $3
EOF
  exit 2
}

# Regexes containing & ; | (bash syntax errors when written inline in [[ =~ ]]):
re_push_short_f='git[[:space:]]+push[^&;|]*[[:space:]]-f([[:space:]]|$)'
re_commit_n='git[[:space:]]+commit[^&;|]*[[:space:]]-[a-zA-Z]*n([[:space:]]|$)'
re_gh_admin='gh[[:space:]]+[^&;|]*--(admin|bypass)'
re_no_verify='(git|gh)[[:space:]][^&;|]*--no-verify'

# --------------------------------------------------------------------------
# 1. Merging pull requests — the #1 reported incident
# --------------------------------------------------------------------------
if [[ "$noq" =~ gh[[:space:]]+pr[[:space:]]+merge ]]; then
  block "no agent-initiated PR merges" \
        "Merging is a human approval decision, not a code change." \
        "Post the PR link and let a human click Merge."
fi

if [[ "$noq" =~ gh[[:space:]]+pr[[:space:]]+review.*--approve ]]; then
  block "no agent-initiated PR approvals" \
        "An agent approving its own work defeats the review gate entirely." \
        "Summarize your review as a comment; a human approves."
fi

# Any MUTATING gh api call (read-only GET stays allowed). This covers repo
# settings ('repos/<slug>' PATCH), merges, protection, environments — every
# admin surface — regardless of -X vs --method spelling or flag position.
# (A deny rule for only '--method PUT' misses the '-X PUT' spelling entirely.)
if [[ "$noq" =~ gh[[:space:]]+api ]] && \
   [[ "$noq" =~ (-X|--method)[[:space:]]+(PUT|POST|PATCH|DELETE) ]]; then
  block "no mutating GitHub API calls" \
        "PUT/POST/PATCH/DELETE via 'gh api' can merge PRs, change repo settings, or weaken protection." \
        "Ask a human to perform this in the GitHub UI, or use a purpose-specific allowed command."
fi

# --------------------------------------------------------------------------
# 2. Writing to protected branches (token-based — no substring matching)
# --------------------------------------------------------------------------
if [[ "$norm" =~ git[[:space:]]+push ]]; then
  if [[ "$noq" =~ (--force|--force-with-lease)([[:space:]]|$) ]] || \
     [[ "$noq" =~ $re_push_short_f ]]; then
    block "no force-push, ever" \
          "Force-push rewrites shared history and can destroy other people's commits." \
          "If history needs fixing, hand the branch to a human."
  fi

  # Examine each argument token after 'git push' (up to a command separator).
  push_args=$(printf '%s' "$norm" | sed 's/.*git[[:space:]]push//; s/[&;|].*$//')
  refspec_seen=""
  for tok in $push_args; do
    case "$tok" in
      -*) continue ;;                      # flags
      origin|upstream) continue ;;         # remotes
    esac
    refspec_seen="yes"
    if [[ "$tok" =~ ^\+ ]]; then
      block "no force-push via '+refspec'" \
            "'git push origin +branch' is a force-push in disguise." \
            "Push without the '+', or hand the branch to a human."
    fi
    # Exact-match the destination branch: 'main', 'refs/heads/main',
    # 'HEAD:main', 'src:refs/heads/main'. Never a substring of another name.
    dest="${tok##*:}"                      # part after last ':' (or whole token)
    dest="${dest#refs/heads/}"
    if [[ "$dest" =~ ^$PROTECTED_BRANCHES_RE$ ]]; then
      block "no direct push to protected branch '$dest'" \
            "Protected branches change only through a reviewed pull request." \
            "Push your feature branch, then 'gh pr create'."
    fi
  done

  # A BARE 'git push' while standing on a protected branch is the same
  # accident — git resolves the target from HEAD.
  if [[ -z "$refspec_seen" ]]; then
    branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
    if [[ "$branch" =~ ^$PROTECTED_BRANCHES_RE$ ]]; then
      block "no bare push while checked out on '$branch'" \
            "'git push' with no refspec pushes HEAD straight to the protected branch." \
            "git switch -c feat/<slug>  # move the work to a branch first"
    fi
  fi
fi

if [[ "$noq" =~ git[[:space:]]+(reset[[:space:]]+--hard|filter-branch|update-ref|reflog[[:space:]]+delete) ]]; then
  block "no destructive history rewriting" \
        "These silently discard committed work with no undo." \
        "Use 'git revert', or hand it to a human."
fi

# --------------------------------------------------------------------------
# 3. Bypassing the safety tooling
# --------------------------------------------------------------------------
# Scoped to the relevant command segment (no spanning across && / ; / |) and
# evaluated on the quote-stripped string, so message/doc text never matches.
if [[ "$noq" =~ $re_no_verify ]] || \
   [[ "$noq" =~ $re_commit_n ]] || \
   [[ "$noq" =~ (HUSKY=0|SKIP_HOOKS) ]] || \
   [[ "$noq" =~ $re_gh_admin ]]; then
  block "no bypassing commit/merge gates" \
        "The gates exist because reviews get skipped under time pressure. Turning them off is never the fix." \
        "Fix what the gate is complaining about."
fi

# --------------------------------------------------------------------------
# 4. Deploying / publishing to a live environment
# --------------------------------------------------------------------------
if [[ "$noq" =~ (az[[:space:]]+(webapp|functionapp|containerapp)[[:space:]]+(deploy|deployment|up)) ]] || \
   [[ "$noq" =~ (msdeploy|Publish-AzWebApp|az[[:space:]]+group[[:space:]]+delete) ]] || \
   [[ "$noq" =~ (terraform[[:space:]]+(apply|destroy)|pulumi[[:space:]]+(up|destroy)) ]] || \
   [[ "$noq" =~ (kubectl[[:space:]]+(apply|delete|rollout)|helm[[:space:]]+(install|upgrade|uninstall)) ]] || \
   [[ "$noq" =~ (gh[[:space:]]+workflow[[:space:]]+(run|enable|disable)|gh[[:space:]]+release[[:space:]]+create) ]] || \
   [[ "$noq" =~ (npm[[:space:]]+publish|docker[[:space:]]+push|dotnet[[:space:]]+nuget[[:space:]]+push) ]]; then
  block "no agent-initiated deploys or releases" \
        "Deploying is an operational decision with blast radius outside this repo." \
        "Prepare the change, then ask a human to trigger the deploy."
fi

# AWS / SAM: deploying, deleting or writing to live infrastructure is a human
# action. Read-only calls (ls, describe-*, get-*, logs tail, sam build/validate)
# stay allowed so agents can diagnose.
re_aws_s3_write='aws[[:space:]]+s3[[:space:]]+(rm|rb|sync|cp|mv|mb)([[:space:]]|$)'
re_aws_ddb_write='aws[[:space:]]+dynamodb[[:space:]]+(delete-table|delete-item|put-item|batch-write-item|update-item|create-table)'
if [[ "$noq" =~ sam[[:space:]]+(deploy|delete|sync)([[:space:]]|$) ]] || \
   [[ "$noq" =~ aws[[:space:]]+cloudformation[[:space:]]+(deploy|delete-stack|update-stack|create-stack|execute-change-set) ]] || \
   [[ "$noq" =~ $re_aws_s3_write ]] || \
   [[ "$noq" =~ aws[[:space:]]+s3api[[:space:]]+(delete|put)-(bucket|object) ]] || \
   [[ "$noq" =~ $re_aws_ddb_write ]] || \
   [[ "$noq" =~ aws[[:space:]]+cognito-idp[[:space:]]+(delete|admin-delete|update|create) ]] || \
   [[ "$noq" =~ aws[[:space:]]+lambda[[:space:]]+(update-function-code|update-function-configuration|delete-function|create-function) ]]; then
  block "no agent-initiated AWS deploys, writes or deletes" \
        "The connected-mode backend is live infrastructure with player data; changes go through a human-run 'sam deploy'." \
        "Prepare the change (sam build, sam validate --lint, tests), then ask a human to deploy. See infra/README.md."
fi

# dotnet publish is fine locally; blocked when it targets a server/share.
if [[ "$noq" =~ dotnet[[:space:]]+publish ]] && \
   [[ "$noq" =~ (\\\\|//[a-zA-Z0-9.-]+/|/p:PublishProfile|--output[[:space:]]+[A-Z]:|inetpub|wwwroot) ]]; then
  block "no publishing to a deployment target" \
        "'dotnet publish' to a UNC path or publish profile IS a deploy." \
        "Publish to a local ./publish directory instead."
fi

# --------------------------------------------------------------------------
# 5. Touching a non-local database
# --------------------------------------------------------------------------
if [[ "$noq" =~ (sqlcmd|Invoke-Sqlcmd|bcp|osql) ]] || \
   [[ "$noq" =~ dotnet[[:space:]]+ef[[:space:]]+database ]]; then
  if [[ ! "$noq" =~ (localhost|127\.0\.0\.1|\(localdb\)|tcp:localhost) ]] || \
     [[ "$noq" =~ (prod|production|-prod|PROD) ]]; then
    block "no database commands outside localhost" \
          "A migration or script against a shared/production database is unrecoverable from here." \
          "Point it at localhost, or hand the script to a DBA."
  fi
fi

# --------------------------------------------------------------------------
# 6. Blunt filesystem destruction
# --------------------------------------------------------------------------
if [[ "$noq" =~ rm[[:space:]]+(-[a-zA-Z]*[rR][a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*[rR])[[:space:]]+(/|~|\$HOME|\*) ]] || \
   [[ "$noq" =~ git[[:space:]]+clean[[:space:]]+-[a-zA-Z]*x ]]; then
  block "no recursive delete of a home or root path" \
        "Not recoverable." \
        "Delete a specific, named subdirectory instead."
fi

exit 0
