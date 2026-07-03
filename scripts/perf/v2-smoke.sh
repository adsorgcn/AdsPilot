#!/usr/bin/env bash
set -euo pipefail

BASE="http://localhost:8080"

measure() {
  local name="$1"; shift
  local method="$1"; shift
  local path="$1"; shift
  local body="${1:-}"
  local start=$(date +%s%3N)
  if [ -n "$body" ]; then
    curl -s -o /dev/null -X "$method" -H 'content-type: application/json' --data "$body" "$BASE$path"
  else
    curl -s -o /dev/null -X "$method" "$BASE$path"
  fi
  local end=$(date +%s%3N)
  local dur=$((end-start))
  echo "$name,$method,$path,$dur" | tee -a v2-smoke.csv
}

echo "name,method,path,ms" > v2-smoke.csv
measure tasks-snapshot GET "/api/v2/tasks/unknown"
measure ops-pool GET "/api/v2/ops/pool/state"
measure analytics-summary GET "/api/v2/adscenter/analytics/summary"
measure analytics-timeseries GET "/api/v2/adscenter/analytics/timeseries"
measure analytics-breakdown GET "/api/v2/adscenter/analytics/breakdown"
echo "Saved to v2-smoke.csv"

