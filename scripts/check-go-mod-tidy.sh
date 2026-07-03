#!/usr/bin/env bash
set -euo pipefail

# Check all Go services for go mod tidy issues
# Usage: ./scripts/check-go-mod-tidy.sh

cd "$(dirname "$0")/.."

echo "🔍 Checking all Go services for go mod tidy issues..."
echo ""

has_issues=0

for service_dir in services/*/go.mod; do
  if [[ ! -f "$service_dir" ]]; then
    continue
  fi

  dir=$(dirname "$service_dir")
  service=$(basename "$dir")

  echo "Checking $service..."

  # Run go mod tidy in a subshell to avoid changing directory
  if ! (cd "$dir" && GOWORK=off go mod tidy 2>&1); then
    echo "  ❌ Failed to run go mod tidy"
    has_issues=1
    continue
  fi

  # Check if go.mod or go.sum changed
  if git diff --quiet "$dir/go.mod" "$dir/go.sum" 2>/dev/null; then
    echo "  ✅ OK"
  else
    echo "  ⚠️  go.mod or go.sum needs update"
    echo "     Run: cd $dir && go mod tidy"
    has_issues=1
  fi
done

echo ""
if [[ $has_issues -eq 0 ]]; then
  echo "✅ All Go services are up to date"
  exit 0
else
  echo "❌ Some services need go mod tidy"
  echo ""
  echo "To fix all services, run:"
  echo "  for dir in services/*/go.mod; do (cd \$(dirname \$dir) && go mod tidy); done"
  exit 1
fi
