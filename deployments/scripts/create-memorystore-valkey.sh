#!/usr/bin/env bash
set -euo pipefail

# Create a Memorystore for Valkey (Redis-compatible) instance
# Usage:
#   PROJECT_ID=<id> REGION=asia-northeast1 INSTANCE_ID=gm-valkey TIER=STANDARD_HA SIZE_GB=1 ./deployments/scripts/create-memorystore-valkey.sh

PROJECT_ID=${PROJECT_ID:-}
REGION=${REGION:-asia-northeast1}
INSTANCE_ID=${INSTANCE_ID:-gm-valkey}
TIER=${TIER:-STANDARD_HA}
SIZE_GB=${SIZE_GB:-1}

if [[ -z "$PROJECT_ID" ]]; then
  echo "PROJECT_ID is required" >&2
  exit 1
fi

# Note: gcloud Redis API currently uses 'redis' resource type naming; Valkey GA 采用相同接口，实例类型在后台区分。
echo "Creating Memorystore instance $INSTANCE_ID in $REGION (tier=$TIER, size=${SIZE_GB}GB) ..."
if gcloud redis instances describe "$INSTANCE_ID" --region "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  echo "Instance $INSTANCE_ID already exists"
  exit 0
fi

gcloud redis instances create "$INSTANCE_ID" \
  --size="$SIZE_GB" \
  --region "$REGION" \
  --tier "$TIER" \
  --replica-count=1 \
  --transit-encryption-mode=server-authentication \
  --redis-version=REDIS_7_0 \
  --project "$PROJECT_ID"

echo "Done. Use the instance's host IP to construct VALKEY_URL (redis://<ip>:6379/0)."

