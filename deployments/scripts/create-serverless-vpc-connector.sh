#!/usr/bin/env bash
set -euo pipefail

# Create a Serverless VPC Connector (if not exists)
# Usage:
#   PROJECT_ID=<id> REGION=asia-northeast1 CONNECTOR=cr-conn-default-ane1 NETWORK=default ./deployments/scripts/create-serverless-vpc-connector.sh

PROJECT_ID=${PROJECT_ID:-}
REGION=${REGION:-asia-northeast1}
CONNECTOR=${CONNECTOR:-cr-conn-default-ane1}
NETWORK=${NETWORK:-default}

if [[ -z "$PROJECT_ID" ]]; then
  echo "PROJECT_ID is required" >&2
  exit 1
fi

if gcloud compute networks vpc-access connectors describe "$CONNECTOR" \
  --region "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  echo "Connector $CONNECTOR already exists"
  exit 0
fi

echo "Creating VPC Access Connector $CONNECTOR in $REGION on network $NETWORK ..."
gcloud compute networks vpc-access connectors create "$CONNECTOR" \
  --region "$REGION" \
  --network "$NETWORK" \
  --min-instances 2 \
  --max-instances 10 \
  --machine-type e2-micro \
  --project "$PROJECT_ID"

echo "Done."

