#!/usr/bin/env bash
set -euo pipefail

# Bind Cloud Run services to a Serverless VPC Connector (for Valkey access)
# Usage:
#   PROJECT_ID=<id> REGION=asia-northeast1 CONNECTOR=cr-conn-default-ane1 ./deployments/scripts/bind-vpc-connector.sh [svc1 svc2 ...]

PROJECT_ID=${PROJECT_ID:-}
REGION=${REGION:-asia-northeast1}
CONNECTOR=${CONNECTOR:-}

if [[ -z "$PROJECT_ID" || -z "$CONNECTOR" ]]; then
  echo "PROJECT_ID and CONNECTOR are required" >&2
  exit 1
fi

services=("$@")
if [[ ${#services[@]} -eq 0 ]]; then
  services=(siterank adscenter offer billing recommendations batchopen notifications console)
fi

for svc in "${services[@]}"; do
  if gcloud run services describe "$svc" --project "$PROJECT_ID" --region "$REGION" >/dev/null 2>&1; then
    echo "Binding $svc to $CONNECTOR"
    gcloud run services update "$svc" \
      --project "$PROJECT_ID" --region "$REGION" \
      --vpc-connector "$CONNECTOR" \
      --vpc-egress all-traffic || true
  else
    echo "Skip $svc (not found)"
  fi
done

echo "Done."

