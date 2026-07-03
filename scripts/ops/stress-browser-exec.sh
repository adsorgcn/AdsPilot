#!/usr/bin/env bash
set -euo pipefail

# Simple concurrency stress test for browser-exec /check-availability
# Usage: BASE=http://localhost:8081 CONCURRENCY=10 N=50 PLAYWRIGHT=0 ./scripts/ops/stress-browser-exec.sh

BASE=${BASE:-"http://localhost:8081"}
CONCURRENCY=${CONCURRENCY:-10}
N=${N:-50}
URL=${URL:-"https://example.com"}

run_one() {
  id=$1
  t0=$(date +%s%3N)
  out=$(curl -fsS -m 10 -H 'Content-Type: application/json' -X POST \
    -d "{\"url\":\"${URL}\",\"timeoutMs\":5000,\"retries\":1,\"backoffMs\":150}" \
    "${BASE}/api/v1/browser/check-availability" || echo '{}')
  t1=$(date +%s%3N)
  ms=$((t1 - t0))
  ok=$(echo "$out" | jq -r '.ok // false' 2>/dev/null || echo false)
  status=$(echo "$out" | jq -r '.status // 0' 2>/dev/null || echo 0)
  echo "$id,$ok,$status,${ms}ms"
}

export -f run_one
seq 1 "$N" | xargs -P "$CONCURRENCY" -I{} bash -lc 'run_one "$@"' _ {}

