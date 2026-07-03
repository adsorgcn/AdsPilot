#!/usr/bin/env bash
set -euo pipefail

# Detect changed backend services since a given base commit.
# Output: JSON array of service names to STDOUT (e.g. ["offer","workflow"]) or [] if none.

BASE="${BASE_SHA:-}"
HEAD="${HEAD_SHA:-}"

LIST_SERVICES_SCRIPT="$(dirname "${BASH_SOURCE[0]}")/list-services.sh"
if [[ -x "${LIST_SERVICES_SCRIPT}" ]]; then
  ALL_SERVICES=$(bash "${LIST_SERVICES_SCRIPT}")
else
  ALL_SERVICES="[]"
fi

if [[ -z "$HEAD" ]]; then
  HEAD=$(git rev-parse HEAD)
fi
if [[ -z "$BASE" ]]; then
  # Try to determine base automatically: previous commit
  BASE=$(git rev-parse "${HEAD}^" 2>/dev/null || true)
fi
if [[ -z "$BASE" ]]; then
  echo "[]"
  exit 0
fi

changed=$(git diff --name-only "$BASE" "$HEAD" || true)

# If core/shared changed -> deploy all
# Note: deployments/api-gateway/ and scripts/gateway/ are excluded from this check
# They will trigger gateway sync separately without forcing full service redeploy
if echo "$changed" | grep -Eq '^(pkg/|go\.work|go\.work\.sum|scripts/deploy/|schemas/|\.github/workflows/deploy-backend\.yml|nginx\.conf|flake\.nix|\.idx/|\.dockerignore$|\.gcloudignore$)'; then
  echo "${ALL_SERVICES}"
  exit 0
fi

services=$(echo "$changed" | awk -F/ '/^services\//{print $2}' | sort -u)

if [[ -z "$services" ]]; then
  echo "[]"
  exit 0
fi

# Build JSON array, only include services with Dockerfile
out="["
first=1
while IFS= read -r s; do
  [[ -z "$s" ]] && continue
  # Only include services that have a Dockerfile (exclude functions, internal, etc.)
  if [[ ! -f "services/${s}/Dockerfile" ]]; then
    echo "[debug] excluding service ${s}: no Dockerfile found" >&2
    continue
  fi
  if [[ $first -eq 0 ]]; then out+=","; else first=0; fi
  out+="\"$s\""
done <<< "$services"
out+="]"
echo "$out"
