#!/usr/bin/env bash
# tests/guardrails/run.sh — proves the action guardrails BLOCK, not merely exist.
#
# A guard with a broken regex passes every "is the file there?" check and stops
# nothing. This suite is the difference between a control and a decoration.
# Wired into quality-sweep.sh, CI, and the feature registry.
#
# NOTE: probes are fed to the guard on STDIN as JSON, so this script never
# contains a bare destructive command that the guard itself would block.

set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || dirname "$0")"

GUARD="scripts/hooks/guard-destructive-commands.sh"
PASS=0; FAIL=0

red()   { printf "\033[1;31m%s\033[0m\n" "$*"; }
green() { printf "\033[1;32m%s\033[0m\n" "$*"; }

if [[ ! -x "$GUARD" ]]; then
  red "FATAL: $GUARD missing or not executable."
  echo "  → chmod +x $GUARD"
  exit 1
fi

# expect: block | allow
check() {
  local expect="$1" cmd="$2" rc payload
  payload=$(jq -n --arg c "$cmd" '{tool_name:"Bash",tool_input:{command:$c}}')
  printf '%s' "$payload" | bash "$GUARD" >/dev/null 2>&1
  rc=$?
  if { [[ "$expect" == "block" && $rc -eq 2 ]] || [[ "$expect" == "allow" && $rc -eq 0 ]]; }; then
    printf "  \033[32mPASS\033[0m  [%s] %s\n" "$expect" "$cmd"; PASS=$((PASS+1))
  else
    printf "  \033[31mFAIL\033[0m  [expected %s, rc=%s] %s\n" "$expect" "$rc" "$cmd"; FAIL=$((FAIL+1))
  fi
}

echo "── Must BLOCK ─────────────────────────────────────────────────────"
check block "gh pr merge 42"
check block "gh pr merge 42 --admin --squash"
check block "cd /some/repo && gh pr merge 42"
check block "bash -c 'gh pr merge 42'"
check block "gh pr review 42 --approve"
check block "gh api -X PUT repos/o/r/pulls/1/merge"
check block "gh api --method DELETE repos/o/r/branches/main/protection"
check block "git push origin main"
check block "git push origin HEAD:main"
check block "git push origin +feat/x"
check block "git push --force origin feature"
check block "git push -f origin develop"
check block "git reset --hard origin/main"
check block "git filter-branch --tree-filter x"
check block "git commit --no-verify -m 'wip'"
check block "HUSKY=0 git commit -m x"
check block "terraform apply -auto-approve"
check block "gh workflow run deploy-pages.yml"
check block "gh release create v1.2.3"
check block "npm publish"
check block "docker push registry.example.com/app:latest"
check block "sam deploy --guided"
check block "sam delete --stack-name survivor"
check block "aws cloudformation delete-stack --stack-name survivor"
check block "aws s3 rm s3://survivor-images --recursive"
check block "aws dynamodb delete-table --table-name survivor"
check block "rm -rf ~/"
check block "git clean -fdx"

echo
echo "── Must ALLOW (no false positives — a noisy guard gets disabled) ───"
check allow "npm ci"
check allow "npm run build"
check allow "npm test"
check allow "npx vitest run tests/architecture"
check allow "npx playwright test"
check allow "bash init.sh"
check allow "bash quality-sweep.sh"
check allow "git status"
check allow "git diff HEAD~1"
check allow "git add ."
check allow "git commit -m 'feat: pick page' && git log --oneline -n 5"
check allow "git commit -m \"document the -n flag\""
check allow "git push -u origin feat/initial-harness"
check allow "git push origin feature/main-page"
check allow "gh pr create --fill"
check allow "gh pr view 42"
check allow "gh run list"
check allow "gh api repos/o/r/pulls/42"
check allow "sam validate --lint"
check allow "sam build"
check allow "aws sts get-caller-identity"
check allow "aws s3 ls"
check allow "aws dynamodb describe-table --table-name survivor"
check allow "grep -rn -- --no-verify docs/"
check allow "terraform plan"

echo
if (( FAIL == 0 )); then
  green "Guardrail tests: ${PASS} passed, 0 failed."
  exit 0
else
  red "Guardrail tests: ${PASS} passed, ${FAIL} FAILED."
  red "A failing BLOCK case means that action is currently reachable by an agent."
  exit 1
fi
