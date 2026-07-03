#!/usr/bin/env bash
set -euo pipefail

# Canary 发布示例：按步进将少量流量引向最新修订版，监控 SLO 后逐步提升。
# 用法：PROJECT=... REGION=asia-northeast1 SERVICE=adscenter STEPS=10 SLEEP=60 bash deployments/scripts/canary-rollout.sh

PROJECT=${PROJECT:?PROJECT required}
REGION=${REGION:-asia-northeast1}
SERVICE=${SERVICE:?SERVICE required}
STEPS=${STEPS:-5}
SLEEP=${SLEEP:-60}

step=$((100 / STEPS))
for p in $(seq $step $step 100); do
  echo "# 提升到 ${p}% 流量"
  gcloud run services update-traffic $SERVICE --project=$PROJECT --region=$REGION --to-latest=${p}
  echo "# 观察 SLO（adscenter business 汇总）..."
  # TODO: 结合 /api/v1/console/adscenter/business 或 Monitoring API 做自动判定
  sleep $SLEEP
done

echo "# 完成 Canary 切换"

