#!/usr/bin/env bash
set -euo pipefail

# 端到端闭环性能测试脚本
# 覆盖：Offer创建 -> Siterank分析 -> Adscenter 诊断/计划/校验/提交 -> 通知快照
# 使用：
#   GATEWAY=https://www.urlchecker.dev AUTH="Bearer <id_token>" N=20 COUNTRY=US \
#   ./scripts/ops/e2e-end2end-perf.sh

for b in curl jq python3; do
  command -v "$b" >/dev/null 2>&1 || { echo "[error] 需要安装 $b" >&2; exit 1; };
done

GATEWAY=${GATEWAY:-}
AUTH=${AUTH:-}
N=${N:-10}
COUNTRY=${COUNTRY:-US}

if [[ -z "$GATEWAY" || -z "$AUTH" ]]; then
  echo "[error] 必须设置 GATEWAY 与 AUTH（Bearer <id_token>）" >&2
  exit 2
fi

HDR=(-H "Authorization: ${AUTH}" -H 'Content-Type: application/json')

# 使用 Python 获取毫秒时间戳，避免 date +%s%3N 的不可移植性（参考 BugFix.md 6.9/29）
ts() { python3 - <<'PY'
import time; print(int(time.time()*1000))
PY
}

dur() { echo $(( $2 - $1 )); }

step() { echo -e "\n=== $* ==="; }

# 计算统计量
percentile() { # args: values...,p (0-100)
  local p=${!#}
  local arr=(${@:1:$(($#-1))})
  IFS=$'\n' arr=($(sort -n <<<"${arr[*]}")); unset IFS
  local n=${#arr[@]}
  if [[ $n -eq 0 ]]; then echo 0; return; fi
  local idx=$(( (p * (n - 1)) / 100 ))
  echo ${arr[$idx]}
}

sum() { local s=0; for x in "$@"; do s=$((s + x)); done; echo $s; }
avg() { local s=$(sum "$@"); local n=$#; if [[ $n -gt 0 ]]; then echo $((s / n)); else echo 0; fi }

# 采样数组
create_offer_ms=()
siterank_analyze_ms=()
siterank_poll_ms=()
ads_diag_chain_ms=()
submit_ms=()

step "开始端到端性能采样 N=$N"
for i in $(seq 1 "$N"); do
  offerName="e2e-perf-$(date +%H%M%S)-$i"
  createBody=$(jq -n --arg name "$offerName" --arg url "https://example.com" '{ name: $name, originalUrl: $url }')

  # 1) 创建 Offer
  t0=$(ts)
  createResp=$(curl -fsS -m 20 "${GATEWAY}/api/v1/offers" -X POST ${HDR[@]} -d "$createBody" || true)
  t1=$(ts)
  offerId=$(echo "$createResp" | jq -r '.id // .offerId // empty')
  if [[ -z "$offerId" ]]; then echo "[warn] 第$i次 Offer 创建失败，跳过该样本" >&2; continue; fi
  create_offer_ms+=( $(dur $t0 $t1) )

  # 2) Siterank 分析（触发）
  t2=$(ts)
  srBody=$(jq -n --arg id "$offerId" --arg c "$COUNTRY" '{ offerId: $id, country: $c }')
  curl -fsS -m 20 "${GATEWAY}/api/v1/siterank/analyze" -X POST ${HDR[@]} -d "$srBody" >/dev/null || true
  t3=$(ts)
  siterank_analyze_ms+=( $(dur $t2 $t3) )

  # 2.1) 轮询最新分析（最多 10 次，每次 1s），统计首个可读结果耗时
  t4=$(ts)
  ok=false
  for _ in $(seq 1 10); do
    resp=$(curl -fsS -m 10 "${GATEWAY}/api/v1/siterank/${offerId}" 2>/dev/null || true)
    score=$(echo "$resp" | jq -r '.score // empty')
    if [[ -n "$score" ]]; then ok=true; break; fi
    sleep 1
  done
  t5=$(ts)
  siterank_poll_ms+=( $(dur $t4 $t5) )

  # 3) Adscenter 诊断 -> 计划 -> 校验
  t6=$(ts)
  metrics=$(curl -fsS -m 20 ${HDR[@]} "${GATEWAY}/api/v1/adscenter/diagnose/metrics?accountId=stub" || true)
  plan=$(curl -fsS -m 20 ${HDR[@]} -X POST -d "$(jq -n --argjson m "$metrics" '{metrics:$m}')" "${GATEWAY}/api/v1/adscenter/diagnose/plan" | jq -c '.plan' || echo '{}')
  valid=$(curl -fsS -m 20 ${HDR[@]} -X POST -d "$plan" "${GATEWAY}/api/v1/adscenter/bulk-actions/validate" | jq -r '.ok // false' || echo 'false')
  t7=$(ts)
  ads_diag_chain_ms+=( $(dur $t6 $t7) )

  # 4) 提交计划（202）
  t8=$(ts)
  submit=$(curl -fsS -m 20 ${HDR[@]} -X POST -d "$plan" "${GATEWAY}/api/v1/adscenter/bulk-actions" || true)
  t9=$(ts)
  submit_ms+=( $(dur $t8 $t9) )
done

echo "\n=== Offer 创建 (ms) ==="
echo "N=${#create_offer_ms[@]} avg=$(avg ${create_offer_ms[@]:-0}) p95=$(percentile ${create_offer_ms[@]:-0} 95)"

echo "\n=== Siterank analyze 触发 (ms) ==="
echo "N=${#siterank_analyze_ms[@]} avg=$(avg ${siterank_analyze_ms[@]:-0}) p95=$(percentile ${siterank_analyze_ms[@]:-0} 95)"

echo "\n=== Siterank 结果轮询首响 (ms) ==="
echo "N=${#siterank_poll_ms[@]} avg=$(avg ${siterank_poll_ms[@]:-0}) p95=$(percentile ${siterank_poll_ms[@]:-0} 95)"

echo "\n=== Adscenter 诊断→计划→校验 (ms) ==="
echo "N=${#ads_diag_chain_ms[@]} avg=$(avg ${ads_diag_chain_ms[@]:-0}) p95=$(percentile ${ads_diag_chain_ms[@]:-0} 95)"

echo "\n=== Adscenter 提交计划 (ms) ==="
echo "N=${#submit_ms[@]} avg=$(avg ${submit_ms[@]:-0}) p95=$(percentile ${submit_ms[@]:-0} 95)"

echo "\n完成。"

