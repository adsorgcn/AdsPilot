#!/usr/bin/env bash
set -euo pipefail

# Minimal contract test runner:
# 1) Validate specs
# 2) Ensure stubs generation works (schema compile)

ROOT=$(cd "$(dirname "$0")/../.." && pwd)

bash "$ROOT/scripts/openapi/validate.sh"

# Attempt stub generation for a quick compile-time schema check
bash "$ROOT/scripts/openapi/gen-go-stubs.sh"

# Generate TypeScript types for FE
OPENAPI_TS_MODE=types bash "$ROOT/scripts/openapi/gen-ts-sdk.sh"

# Extra smoke for settings endpoints
if [[ -f "$ROOT/scripts/openapi/contract-smoke-settings.sh" ]]; then
  bash "$ROOT/scripts/openapi/contract-smoke-settings.sh"
fi

echo "[DONE] Contract checks passed (validation + stubs generation)"
