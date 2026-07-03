#!/usr/bin/env bash
set -euo pipefail

# Validate OpenAPI specs using Redocly or Spectral if available.
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SPEC_DIR="$ROOT/specs/openapi"

if command -v npx >/dev/null 2>&1; then
  if npx --yes @redocly/cli -v >/dev/null 2>&1; then
    echo "[validate] using Redocly CLI"
    for f in "$SPEC_DIR"/*.yaml; do
      echo "-> lint $(basename "$f")"
      npx --yes @redocly/cli lint "$f" || exit 1
    done
    echo "[OK] all specs linted"
    exit 0
  fi
fi

echo "[warn] Redocly not available; basic YAML existence check only"
ls -1 "$SPEC_DIR"/*.yaml

