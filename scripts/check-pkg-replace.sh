#!/bin/bash
# scripts/check-pkg-replace.sh
#
# Verifies that all services have replace directives for pkg modules they use.
# This prevents "module not found" errors in GOWORK=off mode (used by Cloud Build).
#
# Usage:
#   ./scripts/check-pkg-replace.sh
#
# Exit codes:
#   0 - All replace directives are present
#   1 - Missing replace directives found

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🔍 Checking pkg replace directives..."
echo "Repository: $REPO_ROOT"
echo ""

# Known issues: packages referenced in code but don't exist (legacy code)
# These should be cleaned up in future refactoring
KNOWN_MISSING_PKGS="pkg/eventbus"

ERRORS=0

for service_dir in "$REPO_ROOT"/services/*/; do
  service=$(basename "$service_dir")
  go_mod="$service_dir/go.mod"

  # Skip if no go.mod
  if [ ! -f "$go_mod" ]; then
    continue
  fi

  echo "Checking service: $service"

  # Find all pkg imports in Go files
  used_pkgs=$(grep -rh 'github\.com/ScientificInternet/Google-Monetize/pkg/' "$service_dir" \
              --include="*.go" \
              2>/dev/null | \
              sed -n 's/.*"github\.com\/ScientificInternet\/gm\/\(pkg\/[^"]*\)".*/\1/p' | \
              sort -u || true)

  if [ -z "$used_pkgs" ]; then
    echo "  ℹ️  No pkg imports found"
    continue
  fi

  # Check each used pkg for replace directive
  # Support both single-line and block replace formats:
  #   replace github.com/ScientificInternet/Google-Monetize/pkg/xxx => ../../pkg/xxx
  #   replace (
  #     github.com/ScientificInternet/Google-Monetize/pkg/xxx => ../../pkg/xxx
  #   )
  for pkg in $used_pkgs; do
    # Skip known missing packages (legacy code to be cleaned up)
    if echo "$KNOWN_MISSING_PKGS" | grep -q "$pkg"; then
      echo "  ⚠️  $pkg (known legacy import, skipped)"
      continue
    fi

    if ! grep -q "github.com/ScientificInternet/Google-Monetize/$pkg =>" "$go_mod"; then
      echo "  ❌ Missing replace for: $pkg"
      echo "     Add to $service/go.mod:"
      echo "     replace github.com/ScientificInternet/Google-Monetize/$pkg => ../../$pkg"
      ERRORS=$((ERRORS + 1))
    else
      echo "  ✅ $pkg"
    fi
  done

  echo ""
done

if [ $ERRORS -eq 0 ]; then
  echo "✅ All pkg replace directives are present"
  exit 0
else
  echo "❌ Found $ERRORS missing replace directive(s)"
  echo ""
  echo "To fix:"
  echo "  1. Add the missing replace directives to the respective go.mod files"
  echo "  2. Run 'go mod tidy' in each affected service directory"
  echo "  3. Test with: cd services/<service> && env GOWORK=off go build ."
  exit 1
fi
