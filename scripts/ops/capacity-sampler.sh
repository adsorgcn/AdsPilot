#!/usr/bin/env bash
set -euo pipefail

# 容量与成本验证采样脚本（预发）
# - 聚合关键 SLO（/api/v1/console/slo）与浏览器队列/池状态（/api/v1/browser/queue/stats, /api/v1/browser/stats）
# - 输出 NDJSON 到本地文件，便于后续分析容量-成本关系与扩缩容参数
# 用法：
#   GATEWAY=https://www.urlchecker.dev AUTH="Bearer <token>" INTERVAL=10 COUNT=30 \
#   ./scripts/ops/capacity-sampler.sh | tee logs/capacity-samples.ndjson

for b in curl jq python3; do
  command -v "$b" >/dev/null 2>&1 || { echo "[error] 需要安装 $b" >&2; exit 1; };
done

GATEWAY=${GATEWAY:-}
AUTH=${AUTH:-}
INTERVAL=${INTERVAL:-10}
COUNT=${COUNT:-12}

if [[ -z "$GATEWAY" || -z "$AUTH" ]]; then
  echo "[error] 必须设置 GATEWAY 与 AUTH（Bearer <id_token>）" >&2
  exit 2
fi

HDR=(-H "Authorization: ${AUTH}" -H 'Content-Type: application/json')
ts() { python3 - <<'PY'
import time; print(int(time.time()*1000))
PY
}

echo "[info] 采样 ${COUNT} 次，每 ${INTERVAL}s 一次，来源：${GATEWAY}"

for i in $(seq 1 "$COUNT"); do
  now=$(ts)
  slo=$(curl -fsS -m 10 ${HDR[@]} "${GATEWAY}/api/v1/console/slo?force=1" 2>/dev/null || echo '{}')
  beq=$(curl -fsS -m 6 ${HDR[@]} "${GATEWAY}/api/v1/browser/queue/stats" 2>/dev/null || echo '{}')
  bes=$(curl -fsS -m 6 ${HDR[@]} "${GATEWAY}/api/v1/browser/stats" 2>/dev/null || echo '{}')
  # 组装 NDJSON：{ts, slo:{...}, browser:{queue,stats}}
  jq -nc --argjson ts "$now" \
    --argjson slo "$slo" --argjson beq "$beq" --argjson bes "$bes" \
    '{ts:$ts, slo:$slo, browser:{queue:$beq, stats:$bes}}'
  sleep "$INTERVAL"
done

echo "[info] 采样完成"

