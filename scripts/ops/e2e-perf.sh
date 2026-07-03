#!/usr/bin/env bash
set -euo pipefail

# E2E perf test: run multiple iterations and print simple stats.
# Usage:
#   SITERANK_URL=... ADSCENTER_URL=... AUTH="Bearer <token>" N=20 ./scripts/ops/e2e-perf.sh

SITERANK_URL=${SITERANK_URL:-}
ADSCENTER_URL=${ADSCENTER_URL:-}
AUTH=${AUTH:-"Bearer dummy"}
N=${N:-10}

if [[ -z "$SITERANK_URL" || -z "$ADSCENTER_URL" ]]; then echo "need SITERANK_URL and ADSCENTER_URL" >&2; exit 2; fi

ts() { date +%s%3N; }
dur() { echo $(( $2 - $1 )); }

smoke_siterank() {
  local t0=$(ts)
  curl -fsS -m 20 -H 'Content-Type: application/json' \
    -d '{"url":"https://example.com","offerId":"e2e-perf","country":"US"}' \
    "$SITERANK_URL/api/v1/siterank/analyze-url" >/dev/null || true
  local t1=$(ts)
  dur $t0 $t1
}

smoke_adscenter() {
  local t0=$(ts)
  local HDR=( -H "Authorization: ${AUTH}" -H 'Content-Type: application/json' )
  local METRICS=$(curl -fsS -m 20 ${HDR[@]} "$ADSCENTER_URL/api/v1/adscenter/diagnose/metrics?accountId=stub")
  local PLAN=$(curl -fsS -m 20 ${HDR[@]} -X POST -d "$(jq -n --argjson m "$METRICS" '{metrics:$m}')" "$ADSCENTER_URL/api/v1/adscenter/diagnose/plan" | jq -c '.plan')
  local OK=$(curl -fsS -m 20 ${HDR[@]} -X POST -d "$PLAN" "$ADSCENTER_URL/api/v1/adscenter/bulk-actions/validate" | jq -r '.ok // false')
  local t1=$(ts)
  echo $(dur $t0 $t1),$OK
}

times_sr=()
times_ac=()
oks=0
for i in $(seq 1 "$N"); do
  times_sr+=( $(smoke_siterank) )
  r=$(smoke_adscenter)
  t=${r%%,*}
  ok=${r##*,}
  times_ac+=( $t )
  if [[ "$ok" == "true" ]]; then oks=$((oks+1)); fi
done

percentile() { # args: values...,p (0-100)
  local p=${!#}
  local arr=(${@:1:$(($#-1))})
  IFS=$'\n' arr=($(sort -n <<<"${arr[*]}")); unset IFS
  local idx=$(( (p * (${#arr[@]} - 1)) / 100 ))
  echo ${arr[$idx]}
}

sum() { local s=0; for x in "$@"; do s=$((s + x)); done; echo $s; }
avg() { local s=$(sum "$@"); local n=$#; if [[ $n -gt 0 ]]; then echo $((s / n)); else echo 0; fi }

echo "=== Siterank analyze-url timings (ms) ==="
echo "N=$N avg=$(avg ${times_sr[@]}) p95=$(percentile ${times_sr[@]} 95)"

echo "=== Adscenter diagnose->plan->validate timings (ms) ==="
echo "N=$N ok=$oks avg=$(avg ${times_ac[@]}) p95=$(percentile ${times_ac[@]} 95)"

