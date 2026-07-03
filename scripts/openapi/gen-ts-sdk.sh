#!/usr/bin/env bash
set -euo pipefail

# Generate TypeScript SDKs for OpenAPI specs into out/openapi/ts
# Requires either:
#  - Docker with openapitools/openapi-generator-cli, or
#  - npx openapi-typescript (fallback minimal types only)

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SPEC_DIR="$ROOT/specs/openapi"
OUT_DIR="$ROOT/out/openapi/ts"
FE_SDK_DIR="$ROOT/apps/frontend/src/sdk"
mkdir -p "$OUT_DIR"

gen_with_docker() {
  local spec="$1" name="$2"
  docker run --rm -v "$SPEC_DIR:/specs" -v "$OUT_DIR:/out" openapitools/openapi-generator-cli generate \
    -i "/specs/$spec" -g typescript-fetch -o "/out/$name" \
    --additional-properties=supportsES6=true,typescriptThreePlus=true
}

gen_with_npx() {
  local spec="$1" name="$2"
  npx --yes openapi-typescript@7.9.1 "$SPEC_DIR/$spec" -o "$OUT_DIR/$name/index.d.ts"
}

generate() {
  local spec="$1" name="$2"
  # Default to types only for stability; set OPENAPI_TS_MODE=fetch to use docker generator
  if [[ "${OPENAPI_TS_MODE:-types}" == "fetch" ]] && command -v docker >/dev/null 2>&1; then
    echo "[openapi] generating TS SDK via docker (typescript-fetch) for $name from $spec"
    gen_with_docker "$spec" "$name"
  else
    echo "[openapi] generating TS types via npx for $name from $spec"
    gen_with_npx "$spec" "$name"
  fi
  # Sync into frontend sdk directory for developer DX (types only)
  mkdir -p "$FE_SDK_DIR/$name"
  if [[ -f "$OUT_DIR/$name/index.d.ts" ]]; then
    cp "$OUT_DIR/$name/index.d.ts" "$FE_SDK_DIR/$name/types.d.ts"
  fi
}

generate offer.yaml offer
generate siterank.yaml siterank
generate adscenter.yaml adscenter
generate console.yaml console
generate batchopen.yaml batchopen
generate billing.yaml billing
generate notifications.yaml notifications
generate browser-exec.yaml browser
generate recommendations.yaml recommendations
echo "[DONE] SDKs written to $OUT_DIR"
