#!/usr/bin/env bash
set -euo pipefail

# End-to-end perf smoke: Siterank (analyze-url) -> Batchopen (task lifecycle) -> Notifications (recent)
# Requirements: curl, jq
# Usage:
#   SITERANK_URL=https://siterank-preview-... BATCHOPEN_URL=https://batchopen-preview-... NOTIF_URL=https://notifications-preview-... \
#   USER_ID=e2e-user-$(date +%s) URL=https://www.gstatic.com/generate_204 \
#   ./scripts/e2e/e2e-perf.sh

for bin in curl jq; do command -v "$bin" >/dev/null 2>&1 || { echo "[error] $bin is required" >&2; exit 1; }; done

SITERANK_URL=${SITERANK_URL:-"http://localhost:8080"}
BATCHOPEN_URL=${BATCHOPEN_URL:-"http://localhost:8080"}
NOTIF_URL=${NOTIF_URL:-"http://localhost:8080"}
USER_ID=${USER_ID:-"e2e-user"}
URL=${URL:-"https://www.gstatic.com/generate_204"}

echo "[e2e] user=$USER_ID url=$URL"

# Portable millisecond timestamp
ts(){ python3 - <<'PY'
import time; print(int(time.time()*1000))
PY
}

echo "[1/4] Siterank analyze-url"
t0=$(ts)
resp=$(curl -sS -X POST "$SITERANK_URL/api/v1/siterank/analyze-url" -H 'Content-Type: application/json' -d "{\"url\":\"$URL\"}")
analysisId=$(echo "$resp" | jq -r .id)
offerId=$(echo "$resp" | jq -r .offerId)
if [[ -z "$analysisId" || "$analysisId" == "null" ]]; then echo "[error] analyze-url failed: $resp" >&2; exit 1; fi
echo "      analysisId=$analysisId offerId=$offerId (dt=$(( $(ts)-t0 )) ms)"

echo "[2/4] Batchopen create task"
t1=$(ts)
resp=$(curl -sS -X POST "$BATCHOPEN_URL/api/v1/batchopen/tasks" \
  -H 'Content-Type: application/json' -H "X-User-Id: $USER_ID" \
  -d "{\"offerId\":\"$offerId\",\"simulationConfig\":{}}")
taskId=$(echo "$resp" | jq -r .taskId)
if [[ -z "$taskId" || "$taskId" == "null" ]]; then echo "[error] create task failed: $resp" >&2; exit 1; fi
echo "      taskId=$taskId (dt=$(( $(ts)-t1 )) ms)"

echo "[3/4] Batchopen start->complete (simulate)"
t2=$(ts)
curl -sS -X POST "$BATCHOPEN_URL/api/v1/batchopen/tasks/$taskId/start" -H "X-User-Id: $USER_ID" >/dev/null
curl -sS -X POST "$BATCHOPEN_URL/api/v1/batchopen/tasks/$taskId/complete" -H "X-User-Id: $USER_ID" \
  -H 'Content-Type: application/json' -d '{"ok":true}' >/dev/null
echo "      done (dt=$(( $(ts)-t2 )) ms)"

echo "[4/4] Notifications recent"
t3=$(ts)
resp=$(curl -sS "$NOTIF_URL/api/v1/notifications/recent?limit=10" -H "X-User-Id: $USER_ID")
count=$(echo "$resp" | jq '.items | length')
echo "      recent=$count (dt=$(( $(ts)-t3 )) ms)"

echo "[e2e] OK total=$(( $(ts)-t0 )) ms"
