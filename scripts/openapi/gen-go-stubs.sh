#!/usr/bin/env bash
set -eo pipefail

# Generate Go server stubs from OpenAPI specs using oapi-codegen (deepmap).
# Output packages live under each service at internal/oapi.
#
# Requirements:
#  - Network access to fetch oapi-codegen via `go run`
#  - Valid OpenAPI 3 specs in specs/openapi
#
# Usage:
#  ./scripts/openapi/gen-go-stubs.sh [service ...]
#  If no services provided, generate for all Go services we know about.

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SPEC_DIR="$ROOT/specs/openapi"

spec_for() {
  case "$1" in
    offer) echo "offer.yaml" ;;
    siterank) echo "siterank.yaml" ;;
    adscenter) echo "adscenter.yaml" ;;
    batchopen) echo "batchopen.yaml" ;;
    billing) echo "billing.yaml" ;;
    notifications) echo "notifications.yaml" ;;
    recommendations) echo "recommendations.yaml" ;;
    console) echo "console.yaml" ;;
    *) return 1 ;;
  esac
}

services=("$@")
if [[ ${#services[@]} -eq 0 ]]; then
  services=(offer siterank adscenter batchopen billing notifications recommendations console)
fi

gen_one() {
  local svc="$1" spec
  spec=$(spec_for "$svc" || true)
  if [[ -z "$spec" ]]; then
    echo "[skip] no spec mapping for service '$svc'" >&2
    return 0
  fi
  if [[ ! -f "$SPEC_DIR/$spec" ]]; then
    echo "[error] spec not found: $SPEC_DIR/$spec" >&2
    return 1
  fi
  local out_dir="$ROOT/services/$svc/internal/oapi"
  mkdir -p "$out_dir"
  echo "[oapi] generating Go types for $svc from $spec"
  go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@latest \
    --package oapi --generate types \
    -o "$out_dir/types.gen.go" "$SPEC_DIR/$spec"
  echo "[oapi] generating Go server interfaces for $svc from $spec"
  go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@latest \
    --package oapi --generate chi-server \
    -o "$out_dir/server.gen.go" "$SPEC_DIR/$spec"
}

for s in "${services[@]}"; do
  gen_one "$s"
done

echo "[DONE] Go stubs generated under services/*/internal/oapi"
