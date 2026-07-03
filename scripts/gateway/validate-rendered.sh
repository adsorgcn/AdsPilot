#!/usr/bin/env bash
set -euo pipefail

# Validate a rendered API Gateway OpenAPI file to catch common mistakes.
# Usage: scripts/gateway/validate-rendered.sh out/gateway.yaml

SPEC=${1:?rendered gateway yaml required}

echo "[validate-gateway] checking placeholders..."
# Check for unreplaced placeholders (console and workflow are optional)
if grep -qE 'billing-REPLACE|offer-REPLACE|siterank-REPLACE|batchopen-REPLACE|adscenter-REPLACE|<PROJECT_ID>' "$SPEC"; then
  echo "[error] Found unreplaced critical placeholders in $SPEC" >&2
  grep -nE 'billing-REPLACE|offer-REPLACE|siterank-REPLACE|batchopen-REPLACE|adscenter-REPLACE|<PROJECT_ID>' "$SPEC" || true
  exit 1
fi
# Warn about optional console placeholder
if grep -qE 'console-REPLACE' "$SPEC"; then
  echo "[warn] Console service placeholder not replaced (optional)" >&2
  grep -n 'console-REPLACE' "$SPEC" | head -3 || true
fi
# Warn about optional workflow placeholder
if grep -qE 'workflow-REPLACE' "$SPEC"; then
  echo "[warn] Workflow service placeholder not replaced (optional)" >&2
  grep -n 'workflow-REPLACE' "$SPEC" | head -3 || true
fi

echo "[validate-gateway] checking firebase issuer..."
PROJ=${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}
if [[ -n "$PROJ" ]]; then
  if ! grep -q "securetoken.google.com/$PROJ" "$SPEC"; then
    echo "[error] x-google-issuer does not reference project $PROJ" >&2
    exit 1
  fi
fi

echo "[validate-gateway] checking x-google-backend addresses..."
if ! grep -q "x-google-backend:" "$SPEC"; then
  echo "[error] no x-google-backend sections found" >&2
  exit 1
fi

echo "[OK] gateway spec basic validation passed"

