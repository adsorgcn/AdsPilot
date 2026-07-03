#!/usr/bin/env bash
set -euo pipefail

# This script checks the health of all microservices.

SERVICES=(
  "billing:8082"
  "offer:8083"
  "siterank:8084"
  "batchopen:8085"
  "adscenter:8086"
)

echo "--- Starting Health Checks ---"
all_ok=true

for service_info in "${SERVICES[@]}"; do
  IFS=':' read -r service_name port <<< "$service_info"
  url="http://127.0.0.1:${port}/healthz"
  
  printf "Checking %-15s at %s... " "$service_name" "$url"
  
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 5 "$url" || true)
  
  if [[ "$code" == "200" ]]; then
    echo "✅ OK"
  else
    echo "❌ FAILED (HTTP Code: $code)"
    all_ok=false
  fi
done

echo "--- Health Checks Complete ---"

if [ "$all_ok" = true ]; then
  echo "✅ All services are healthy."
  exit 0
else
  echo "❌ Some services are not healthy."
  exit 1
fi
