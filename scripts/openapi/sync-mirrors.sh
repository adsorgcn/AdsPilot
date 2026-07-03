#!/usr/bin/env bash
set -euo pipefail

# Sync canonical OpenAPI specs from .kiro/specs/.../openapi/*.yaml to services/*/openapi.yaml
# Usage: scripts/openapi/sync-mirrors.sh [service...]

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SPEC_DIR="$ROOT/specs/openapi"

services=("$@")
if [[ ${#services[@]} -eq 0 ]]; then
  mapfile -t services < <(ls -1 "$SPEC_DIR"/*.yaml | sed -E 's#.*/([^/]+)\.yaml#\1#' | sort)
fi

for svc in "${services[@]}"; do
  src="$SPEC_DIR/$svc.yaml"
  dst="$ROOT/services/$svc/openapi.yaml"
  if [[ ! -f "$src" ]]; then
    echo "[warn] canonical spec not found for service '$svc' at $src" >&2
    continue
  fi
  if [[ ! -d "$ROOT/services/$svc" ]]; then
    echo "[warn] service directory not found: services/$svc" >&2
    continue
  fi
  mkdir -p "$(dirname "$dst")"
  # Prepend mirror note header and write
  {
    echo "# NOTE: Canonical OpenAPI specs live under specs/openapi/*.yaml"
    echo "#       This file is a local mirror for reference only and may be stale."
    sed '1,2{/^openapi:/!b;}' "$src" >/dev/null 2>&1 || true
  } > /dev/null
  # Pack the header + file
  {
    echo "# NOTE: Canonical OpenAPI specs live under specs/openapi/*.yaml"
    echo "#       This file is a local mirror for reference only and may be stale."
    cat "$src"
  } > "$dst"
  echo "[sync] $svc -> services/$svc/openapi.yaml"
done

echo "[DONE] Mirrors synced"

