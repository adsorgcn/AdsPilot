#!/usr/bin/env bash
set -euo pipefail

# Smoke test for Adscenter diagnose endpoints
# Usage: ./scripts/ops/smoke-adscenter-diagnose.sh <adscenter_base_url>

BASE_URL=${1:-"http://localhost:8080"}

echo "[smoke] Get stub metrics"
curl -sS -H "Authorization: Bearer dummy" "$BASE_URL/api/v1/adscenter/diagnose/metrics?accountId=123-456-7890" | jq . || true

echo "[smoke] Run diagnose with sample metrics"
curl -sS -X POST \
  -H "Authorization: Bearer dummy" \
  -H "Content-Type: application/json" \
  -d '{"accountId":"123-456-7890","landingUrl":"https://example.com","metrics":{"impressions":1200,"ctr":0.4,"qualityScore":4,"dailyBudget":20,"budgetPacing":1.1}}' \
  "$BASE_URL/api/v1/adscenter/diagnose" | jq . || true

echo "[smoke] Generate plan from metrics (validateOnly by API contract)"
curl -sS -X POST \
  -H "Authorization: Bearer dummy" \
  -H "Content-Type: application/json" \
  -d '{"accountId":"123-456-7890","metrics":{"impressions":1200,"ctr":0.4,"qualityScore":4,"dailyBudget":20,"budgetPacing":1.1}}' \
  "$BASE_URL/api/v1/adscenter/diagnose/plan" | jq . || true

echo "[done]"

