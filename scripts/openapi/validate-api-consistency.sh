#!/usr/bin/env bash
set -euo pipefail

# Validate consistency between OpenAPI specs, Gateway config, and frontend endpoints
# This script ensures all three sources are in sync

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SPEC_DIR="$ROOT/specs/openapi"
GATEWAY_CONFIG="$ROOT/deployments/api-gateway/gateway.yaml"
ENDPOINTS_TS="$ROOT/apps/frontend/src/lib/api/endpoints.ts"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

errors=0
warnings=0

echo "🔍 Validating API consistency..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if files exist
if [[ ! -f "$GATEWAY_CONFIG" ]]; then
  echo -e "${RED}❌ Gateway config not found: $GATEWAY_CONFIG${NC}"
  ((errors++))
fi

if [[ ! -f "$ENDPOINTS_TS" ]]; then
  echo -e "${RED}❌ endpoints.ts not found: $ENDPOINTS_TS${NC}"
  ((errors++))
fi

# Extract all API paths from OpenAPI specs
echo "📋 Step 1: Extracting API paths from OpenAPI specs..."
spec_paths_tmp=$(mktemp)
for spec in "$SPEC_DIR"/*.yaml; do
  [[ ! -f "$spec" ]] && continue
  service=$(basename "$spec" .yaml)
  paths=$(grep -E '^\s+/api/v1/' "$spec" | sed 's/://g' | xargs || true)
  count=$(echo "$paths" | wc -w | xargs)
  echo "  ├─ $service: $count endpoints"
  # Store paths in temp file
  for path in $paths; do
    echo "$path" >> "$spec_paths_tmp"
  done
done
echo ""

# Extract paths from Gateway config
echo "📋 Step 2: Extracting paths from Gateway config..."
gateway_paths=$(grep -E '^\s+/api/v1/' "$GATEWAY_CONFIG" | sed 's/://g' | xargs || true)
gateway_count=$(echo "$gateway_paths" | wc -w | xargs)
echo "  └─ Gateway: $gateway_count endpoints"
echo ""

# Check Gateway coverage
echo "🔍 Step 3: Checking Gateway coverage..."
missing_count=0
while IFS= read -r path; do
  if ! echo "$gateway_paths" | grep -q "$path"; then
    echo -e "${YELLOW}⚠️  Missing in Gateway: $path${NC}"
    ((warnings++))
    ((missing_count++))
  fi
done < "$spec_paths_tmp"

if [[ $missing_count -eq 0 ]]; then
  echo -e "${GREEN}✅ All OpenAPI paths are in Gateway config${NC}"
fi
echo ""

# Check if endpoints.ts is auto-generated
echo "🔍 Step 4: Checking endpoints.ts..."
if grep -q "🤖 本文件由.*自动生成" "$ENDPOINTS_TS" 2>/dev/null; then
  echo -e "${GREEN}✅ endpoints.ts is auto-generated${NC}"
else
  echo -e "${YELLOW}⚠️  endpoints.ts is not marked as auto-generated${NC}"
  echo "   Run: scripts/openapi/generate-endpoints.sh"
  ((warnings++))
fi
echo ""

# Validate OpenAPI specs
echo "🔍 Step 5: Validating OpenAPI specs..."
validation_errors=0
for spec in "$SPEC_DIR"/*.yaml; do
  service=$(basename "$spec" .yaml)

  # Check for required fields
  if ! grep -q "^info:" "$spec"; then
    echo -e "${RED}❌ Missing 'info' in $service${NC}"
    ((validation_errors++))
  fi

  if ! grep -q "^paths:" "$spec"; then
    echo -e "${RED}❌ Missing 'paths' in $service${NC}"
    ((validation_errors++))
  fi

  # Check for security definitions
  if grep -q "security:" "$spec" && ! grep -q "securityDefinitions:" "$spec"; then
    echo -e "${YELLOW}⚠️  $service uses security but missing securityDefinitions${NC}"
    ((warnings++))
  fi
done

if [[ $validation_errors -eq 0 ]]; then
  echo -e "${GREEN}✅ All OpenAPI specs are valid${NC}"
else
  ((errors += validation_errors))
fi
echo ""

# Check for duplicate paths
echo "🔍 Step 6: Checking for duplicate paths..."
duplicates=$(sort "$spec_paths_tmp" | uniq -d)
if [[ -n "$duplicates" ]]; then
  echo -e "${RED}❌ Duplicate paths found:${NC}"
  dup_count=0
  echo "$duplicates" | while read -r dup; do
    [[ -z "$dup" ]] && continue
    echo "   - $dup"
    ((dup_count++))
  done
  # Count duplicates properly
  dup_count=$(echo "$duplicates" | grep -c "^/api" || echo 0)
  ((errors += dup_count))
else
  echo -e "${GREEN}✅ No duplicate paths${NC}"
fi

# Clean up temp file
rm -f "$spec_paths_tmp"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Validation Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ $errors -eq 0 ]] && [[ $warnings -eq 0 ]]; then
  echo -e "${GREEN}✨ All checks passed!${NC}"
  echo ""
  echo "  ✅ OpenAPI specs are valid"
  echo "  ✅ Gateway config is complete"
  echo "  ✅ endpoints.ts is up-to-date"
  echo "  ✅ No duplicates or conflicts"
  exit 0
elif [[ $errors -eq 0 ]]; then
  echo -e "${YELLOW}⚠️  $warnings warning(s) found${NC}"
  echo ""
  echo "Warnings are non-blocking but should be addressed."
  exit 0
else
  echo -e "${RED}❌ $errors error(s) and $warnings warning(s) found${NC}"
  echo ""
  echo "Please fix the errors above before deploying."
  exit 1
fi
