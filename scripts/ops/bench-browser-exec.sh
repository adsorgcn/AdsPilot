#!/usr/bin/env bash
set -euo pipefail

# Simple benchmark for browser-exec /check-availability
# Usage:
#   BASE="https://browser-exec-preview-xxxxx.a.run.app" CONCURRENCY=8 N=200 URL="https://www.gstatic.com/generate_204" ./scripts/ops/bench-browser-exec.sh

BASE=${BASE:-"http://localhost:8080"}
CONCURRENCY=${CONCURRENCY:-8}
N=${N:-100}
URL=${URL:-"https://www.gstatic.com/generate_204"}
TOKEN=${BROWSER_INTERNAL_TOKEN:-""}

echo "[bench] base=$BASE conc=$CONCURRENCY n=$N url=$URL"

payload() {
  cat <<JSON
{"url":"$URL","timeoutMs":1500,"retries":1,"backoffMs":150}
JSON
}

hdr=()
if [[ -n "$TOKEN" ]]; then hdr+=( -H "Authorization: Bearer $TOKEN" ); fi

start=$(date +%s%3N)
seq 1 "$N" | xargs -P "$CONCURRENCY" -I{} sh -c \
  "curl -sS -X POST '$BASE/api/v1/browser/check-availability' -H 'Content-Type: application/json' ${hdr[*]} -d '$(payload)' >/dev/null || true"
end=$(date +%s%3N)

dur=$((end-start))
rate=$(awk -v n="$N" -v ms="$dur" 'BEGIN{ printf("%.2f", (n/(ms/1000.0))) }')
echo "[bench] total=${dur}ms, throughput=${rate} req/s"

