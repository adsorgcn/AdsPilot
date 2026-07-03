#!/usr/bin/env bash
set -euo pipefail

# Sample E2E latency N times and compute P95s.
# Usage example:
#   N=20 USER_ID=e2e-user-$(date +%s) \
#   SITERANK_URL=https://siterank-preview-... \
#   BATCHOPEN_URL=https://batchopen-preview-... \
#   NOTIF_URL=https://notifications-preview-... \
#   URL=https://www.gstatic.com/generate_204 \
#   ./scripts/e2e/e2e-sample.sh

for b in curl jq python3; do command -v "$b" >/dev/null 2>&1 || { echo "[error] require $b" >&2; exit 1; }; done

N=${N:-20}
SITERANK_URL=${SITERANK_URL:?SITERANK_URL required}
BATCHOPEN_URL=${BATCHOPEN_URL:?BATCHOPEN_URL required}
NOTIF_URL=${NOTIF_URL:?NOTIF_URL required}
USER_ID=${USER_ID:-"e2e-user"}
URL=${URL:-"https://www.gstatic.com/generate_204"}

ts(){ python3 - <<'PY'
import time; print(int(time.time()*1000))
PY
}

echo "[e2e-sample] N=$N user=$USER_ID"

S=() B=() C=() R=() T=()
for ((i=1;i<=N;i++)); do
  t0=$(ts)
  # 1) siterank analyze-url
  t=$(ts)
  resp=$(curl -sS -X POST "$SITERANK_URL/api/v1/siterank/analyze-url" -H 'Content-Type: application/json' -d "{\"url\":\"$URL\"}") || resp='{}'
  dt=$(( $(ts)-t ))
  S+=("$dt")
  offerId=$(echo "$resp" | jq -r .offerId 2>/dev/null || echo "")
  # 2) batchopen create
  t=$(ts)
  resp=$(curl -sS -X POST "$BATCHOPEN_URL/api/v1/batchopen/tasks" -H 'Content-Type: application/json' -H "X-User-Id: $USER_ID" -d "{\"offerId\":\"$offerId\",\"simulationConfig\":{}}") || resp='{}'
  dt=$(( $(ts)-t ))
  B+=("$dt")
  taskId=$(echo "$resp" | jq -r .taskId 2>/dev/null || echo "")
  # 3) start->complete
  t=$(ts)
  curl -sS -X POST "$BATCHOPEN_URL/api/v1/batchopen/tasks/$taskId/start" -H "X-User-Id: $USER_ID" >/dev/null || true
  curl -sS -X POST "$BATCHOPEN_URL/api/v1/batchopen/tasks/$taskId/complete" -H "X-User-Id: $USER_ID" -H 'Content-Type: application/json' -d '{"ok":true}' >/dev/null || true
  dt=$(( $(ts)-t ))
  C+=("$dt")
  # 4) notifications recent
  t=$(ts)
  curl -sS "$NOTIF_URL/api/v1/notifications/recent?limit=5" -H "X-User-Id: $USER_ID" >/dev/null || true
  dt=$(( $(ts)-t ))
  R+=("$dt")
  T+=("$(( $(ts)-t0 ))")
done

percentile(){ python3 - "$@" <<'PY'
import sys,math,json
arr=list(map(int,sys.argv[1:]))
if not arr: print(0); sys.exit(0)
arr.sort()
def p(x):
  k=(len(arr)-1)*x
  f=math.floor(k); c=math.ceil(k)
  if f==c: return arr[int(k)]
  return int(arr[f]*(c-k)+arr[c]*(k-f))
print(json.dumps({
  'p50':p(0.5), 'p90':p(0.9), 'p95':p(0.95), 'p99':p(0.99)
}))
PY
}

echo "[pctl] siterank:     $(percentile "${S[@]}")"
echo "[pctl] batch-create: $(percentile "${B[@]}")"
echo "[pctl] start-compl:  $(percentile "${C[@]}")"
echo "[pctl] notif-recent: $(percentile "${R[@]}")"
echo "[pctl] total:        $(percentile "${T[@]}")"

