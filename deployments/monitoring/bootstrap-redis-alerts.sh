#!/usr/bin/env bash
set -euo pipefail

# Create Cloud Monitoring alerting policies for Memorystore for Redis
# Usage:
#   PROJECT_ID=<id> REGION=asia-northeast1 INSTANCE_ID=gm-redis ./deployments/monitoring/bootstrap-redis-alerts.sh

PROJECT_ID=${PROJECT_ID:-}
REGION=${REGION:-asia-northeast1}
INSTANCE_ID=${INSTANCE_ID:-}
METRIC_PREFIX=redis.googleapis.com

if [[ -z "$PROJECT_ID" || -z "$INSTANCE_ID" ]]; then
  echo "Usage: PROJECT_ID=<id> REGION=<region> INSTANCE_ID=<instance> $0" >&2
  exit 1
fi

RESOURCE_FILTER="resource.type=\"redis_instance\" AND resource.label.\"project_id\"=\"$PROJECT_ID\" AND resource.label.\"region\"=\"$REGION\" AND resource.label.\"instance_id\"=\"$INSTANCE_ID\""

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

cat > "$TMP_DIR/memory_usage_policy.json" <<EOF
{
  "displayName": "Redis Memory Usage > 80%",
  "combiner": "OR",
  "conditions": [
    {
      "displayName": "Memory usage ratio > 0.8 (5m)",
      "conditionMonitoringQueryLanguage": {
        "query": "fetch redis_instance | metric '$METRIC_PREFIX/stats/memory/usage_ratio' | filter $RESOURCE_FILTER | group_by 1m, [v: mean(value.usage_ratio)] | condition v > 0.8"
      }
    }
  ],
  "notificationChannels": [],
  "enabled": true
}
EOF

cat > "$TMP_DIR/evicted_keys_policy.json" <<EOF
{
  "displayName": "Redis Evicted Keys > 0",
  "combiner": "OR",
  "conditions": [
    {
      "displayName": "Evicted keys delta > 0 (5m)",
      "conditionMonitoringQueryLanguage": {
        "query": "fetch redis_instance | metric '$METRIC_PREFIX/stats/evicted_keys_count' | filter $RESOURCE_FILTER | align delta(5m) | condition val() > 0"
      }
    }
  ],
  "notificationChannels": [],
  "enabled": true
}
EOF

cat > "$TMP_DIR/latency_policy.json" <<EOF
{
  "displayName": "Redis Command Latency P99 > 50ms",
  "combiner": "OR",
  "conditions": [
    {
      "displayName": "Commands latency p99 > 50ms (5m)",
      "conditionMonitoringQueryLanguage": {
        "query": "fetch redis_instance | metric '$METRIC_PREFIX/commands/latency' | filter $RESOURCE_FILTER | group_by 1m, [p99: percentile(value.latency, 99)] | condition p99 > 0.05 s"
      }
    }
  ],
  "notificationChannels": [],
  "enabled": true
}
EOF

echo "Creating Redis alerting policies in project $PROJECT_ID ..."
gcloud monitoring policies create --project "$PROJECT_ID" --policy-from-file="$TMP_DIR/memory_usage_policy.json" || true
gcloud monitoring policies create --project "$PROJECT_ID" --policy-from-file="$TMP_DIR/evicted_keys_policy.json" || true
gcloud monitoring policies create --project "$PROJECT_ID" --policy-from-file="$TMP_DIR/latency_policy.json" || true

echo "Done. Attach notification channels via Cloud Console if needed."

