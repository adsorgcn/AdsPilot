#!/usr/bin/env bash
set -euo pipefail

# 读取 capacity-sampler 生成的 NDJSON，输出汇总 JSON（队列长度、各服务 p95）
# 并可选做阈值断言（不满足则退出码非零），便于 CI 使用。
# 用法：
#   FILE=logs/capacity-samples.ndjson bash scripts/ops/capacity-report.sh
#   或：cat logs/capacity-samples.ndjson | bash scripts/ops/capacity-report.sh -

FILE=${1:-${FILE:-}}
ASSERT=${ASSERT:-}
MAX_QUEUE_P95=${MAX_QUEUE_P95:-10}
MAX_SITERANK_P95=${MAX_SITERANK_P95:-10000}   # 10s
MAX_ADSCENTER_P95=${MAX_ADSCENTER_P95:-1000}  # 1s

if [[ -z "$FILE" ]]; then echo "usage: capacity-report.sh <file|->" >&2; exit 2; fi

out=$(python3 "$(dirname "$0")/capacity-summarize.py" "$FILE")
echo "$out"

if [[ "${ASSERT}" == "1" ]]; then
  q95=$(echo "$out" | jq -r '.browser_queue_len.p95 // 0')
  sr=$(echo "$out" | jq -r '.service_p95_ms.siterank.p95_of_p95 // 0')
  ac=$(echo "$out" | jq -r '.service_p95_ms.adscenter.p95_of_p95 // 0')
  ok=1
  if (( ${q95:-0} > MAX_QUEUE_P95 )); then echo "[assert] queue p95 $q95 > $MAX_QUEUE_P95" >&2; ok=0; fi
  if (( ${sr:-0} > MAX_SITERANK_P95 )); then echo "[assert] siterank p95_of_p95 $sr > $MAX_SITERANK_P95" >&2; ok=0; fi
  if (( ${ac:-0} > MAX_ADSCENTER_P95 )); then echo "[assert] adscenter p95_of_p95 $ac > $MAX_ADSCENTER_P95" >&2; ok=0; fi
  if [[ $ok -ne 1 ]]; then exit 1; fi
fi

echo "[ok] capacity report generated"

