#!/usr/bin/env bash
set -euo pipefail

# Check service OpenAPI mirrors against canonical specs under .kiro/specs/.../openapi/*.yaml
# This is a best-effort, non-fatal check that prints warnings on differences.

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SPEC_DIR="$ROOT/specs/openapi"

warn() { echo "[warn] $*" >&2; }

mapfile -t services < <(ls -1 "$ROOT"/services/*/openapi.yaml 2>/dev/null | sed -E 's#.*/services/([^/]+)/openapi.yaml#\1#' | sort)

if [[ ${#services[@]} -eq 0 ]]; then
  echo "[info] no service openapi mirrors present; nothing to check"
  exit 0
fi

rc=0
for svc in "${services[@]}"; do
  svc_path="$ROOT/services/$svc/openapi.yaml"
  spec_path="$SPEC_DIR/$svc.yaml"
  if [[ ! -f "$spec_path" ]]; then
    warn "no canonical spec for service '$svc' at $spec_path"
    continue
  fi
  # Normalize by stripping comment lines and whitespace-only lines for diff
  tmp1=$(mktemp); tmp2=$(mktemp)
  sed '/^#/d' "$svc_path" | sed '/^\s*$/d' > "$tmp1"
  sed '/^#/d' "$spec_path" | sed '/^\s*$/d' > "$tmp2"
  if ! diff -q "$tmp1" "$tmp2" >/dev/null 2>&1; then
    warn "mirror differs: services/$svc/openapi.yaml vs .kiro/specs/openapi/$svc.yaml"
    rc=0 # do not fail CI; informational only
  fi
  rm -f "$tmp1" "$tmp2"
done

echo "[OK] mirror check completed (warnings above if any)."
exit $rc

