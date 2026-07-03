#!/usr/bin/env bash
set -euo pipefail

# Generate code/types from OpenAPI specs (Go stubs via oapi-codegen, TS types via openapi-typescript)
# Prerequisites: go install github.com/deepmap/oapi-codegen/cmd/oapi-codegen@latest; npm i -g openapi-typescript

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SPEC_DIR="$ROOT/specs/openapi"

gen_go() {
  local svc="$1" outdir="$2"
  mkdir -p "$outdir"
  # all services: generate types then chi-server
  oapi-codegen -generate types -package oapi -o "$outdir/types.gen.go" "$SPEC_DIR/$svc.yaml"
  oapi-codegen -generate chi-server -package oapi -o "$outdir/server.gen.go" "$SPEC_DIR/$svc.yaml"
}

gen_ts() {
  local svc="$1" outdir="$2"
  mkdir -p "$outdir"
  npx --yes openapi-typescript@7.9.1 "$SPEC_DIR/$svc.yaml" -o "$outdir/types.d.ts"
}

echo "[OAS] generating Go stubs (selective)"
gen_go offer "$ROOT/services/offer/internal/oapi" || echo "offer go stubs skipped"
gen_go siterank "$ROOT/services/siterank/internal/oapi" || echo "siterank go stubs skipped"
gen_go adscenter "$ROOT/services/adscenter/internal/oapi" || echo "adscenter go stubs skipped"
gen_go batchopen "$ROOT/services/batchopen/internal/oapi" || echo "batchopen go stubs skipped"
gen_go billing "$ROOT/services/billing/internal/oapi" || echo "billing go stubs skipped"
gen_go recommendations "$ROOT/services/recommendations/internal/oapi" || echo "recommendations go stubs skipped"
gen_go console "$ROOT/services/console/internal/oapi" || echo "console go stubs skipped"

echo "[OAS] generating TS types (shared-types package)"
gen_ts offer "$ROOT/packages/shared-types/src/offer" || true
gen_ts siterank "$ROOT/packages/shared-types/src/siterank" || true
gen_ts adscenter "$ROOT/packages/shared-types/src/adscenter" || true
gen_ts console "$ROOT/packages/shared-types/src/console" || true
gen_ts recommendations "$ROOT/packages/shared-types/src/recommendations" || true
gen_ts batchopen "$ROOT/packages/shared-types/src/batchopen" || true
gen_ts billing "$ROOT/packages/shared-types/src/billing" || true

echo "[OAS] generating frontend API endpoints"
"$ROOT/scripts/openapi/generate-endpoints.sh" || echo "[WARN] Failed to generate endpoints.ts"

echo "[DONE] OpenAPI generate"
