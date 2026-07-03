#!/usr/bin/env bash
set -euo pipefail

# Blue/Green 切换示例脚本（Cloud Run）。
# 步骤：部署新修订版（绿色），验证健康后，将流量从蓝色切换到绿色。
# 用法：PROJECT=... REGION=asia-northeast1 SERVICE=adscenter STACK=preview GREEN_REV=... BLUE_PCT=100 GREEN_PCT=0 bash deployments/scripts/bluegreen-rollout.sh

PROJECT=${PROJECT:?PROJECT required}
REGION=${REGION:-asia-northeast1}
SERVICE=${SERVICE:?SERVICE required}
BLUE_PCT=${BLUE_PCT:-100}
GREEN_PCT=${GREEN_PCT:-0}

echo "# 当前流量："
gcloud run services describe $SERVICE --project=$PROJECT --region=$REGION --format='value(status.trafficStatuses)'

echo "# 设置蓝绿流量：蓝=${BLUE_PCT}% 绿=${GREEN_PCT}%（需先创建绿色修订版）"
gcloud run services update-traffic $SERVICE --project=$PROJECT --region=$REGION \
  --to-latest=$GREEN_PCT --to-revisions=$BLUE_PCT

echo "# 验证健康：请确保 /readyz 正常后，再切换 100% 到绿色"

