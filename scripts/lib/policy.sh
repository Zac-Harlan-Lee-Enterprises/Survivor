# policy.sh — single source of truth for harness policy values.
#
# Sourced by: scripts/hooks/pre-commit, scripts/hooks/commit-msg,
# scripts/hooks/pre-push, scripts/hooks/guard-destructive-commands.sh,
# and quality-sweep.sh. Change a value HERE, never in a consumer.
#
# This file is itself a sensitive path (it configures the guardrails):
# changes require human approval + a SECURITY-REVIEW commit trailer.

# Branches that only change through a reviewed PR.
PROTECTED_BRANCHES_RE='(main|master|release(/[^[:space:]]*)?|gh-pages)'

# Paths whose modification requires recorded human approval (enforced by
# scripts/hooks/commit-msg; mirrored as ask rules in .claude/settings.json —
# quality-sweep.sh cross-checks the two).
SENSITIVE_PATH_PATTERNS=(
  '^\.github/'
  '^infra/'
  '^deploy/'
  '^\.claude/settings\.json$'
  '^scripts/hooks/'
  '^scripts/lib/'
  '^CODEOWNERS$'
  '^harden-github\.sh$'
)

# Secret detection. One pattern per concern; used by both the pre-commit
# staged scan and the quality-sweep repo scan. Add ONE line per new leak
# pattern after an incident.
SECRET_RE='(AKIA[0-9A-Z]{16}'
SECRET_RE+='|ASIA[0-9A-Z]{16}'
SECRET_RE+='|aws_secret_access_key[[:space:]]*=[[:space:]]*[A-Za-z0-9/+=]{30,}'
SECRET_RE+='|xox[baprs]-[A-Za-z0-9-]{10,}'
SECRET_RE+='|gh[pousr]_[A-Za-z0-9]{36,}'
SECRET_RE+='|github_pat_[A-Za-z0-9_]{22,}'
SECRET_RE+='|-----BEGIN [A-Z ]*PRIVATE KEY-----'
SECRET_RE+='|[Pp]assword=[^;"'"'"'[:space:]]{8,};'
SECRET_RE+='|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}'
SECRET_RE+='|sk-[A-Za-z0-9]{32,}'
SECRET_RE+='|sk-ant-[A-Za-z0-9_-]{20,}'
SECRET_RE+='|VITE_[A-Z_]*(SECRET|PRIVATE|PASSWORD|ACCESS_KEY)[A-Z_]*=.+)'
