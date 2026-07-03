#!/usr/bin/env bash
set -euo pipefail

# Lightweight smoke checks for API Gateway and services.

GATEWAY_HOST="${GATEWAY_HOST:-gm-gw-885pd7lz.an.gateway.dev}"
TIMEOUT="${TIMEOUT:-10}"

curl_s() {
  local url="$1"
  local code
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$url" || true)
  echo "[$code] $url"
}

echo "== API Gateway =="
curl_s "https://${GATEWAY_HOST}/api/health" || true
curl_s "https://${GATEWAY_HOST}/api/health/console" || true
curl_s "https://${GATEWAY_HOST}/api/v1/offers" || true  # expect 401 when no JWT

echo
echo "== Direct services (best-effort) =="
SERVICES=$(cat <<'EOF'
adscenter https://adscenter-yt54xvsg5q-an.a.run.app
identity https://identity-yt54xvsg5q-an.a.run.app
offer https://offer-yt54xvsg5q-an.a.run.app
siterank https://siterank-yt54xvsg5q-an.a.run.app
workflow https://workflow-yt54xvsg5q-an.a.run.app
billing https://billing-yt54xvsg5q-an.a.run.app
batchopen https://batchopen-yt54xvsg5q-an.a.run.app
EOF
)

while read -r name base; do
  [ -z "$name" ] && continue
  for path in /health /healthz /; do
    url="${base}${path}"
    code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$url" || true)
    echo "[$code] $url"
    if [ "$code" != "000" ]; then break; fi
  done
done <<< "$SERVICES"

echo "Done."
