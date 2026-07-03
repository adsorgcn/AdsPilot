#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SPEC_DIR="$ROOT/specs/openapi"

echo "[contract] assert new paths exist in OAS"
grep -q "/offers/{id}/preferences" "$SPEC_DIR/offer.yaml" || { echo "missing preferences path in offer.yaml" >&2; exit 1; }
grep -q "/api/v1/console/notifications/settings" "$SPEC_DIR/console.yaml" || { echo "missing notifications settings path" >&2; exit 1; }
grep -q "/api/v1/adscenter/settings/link-rotation" "$SPEC_DIR/adscenter.yaml" || { echo "missing link-rotation settings path" >&2; exit 1; }

echo "[contract] OK"

