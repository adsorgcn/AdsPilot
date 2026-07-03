#!/usr/bin/env bash
set -euo pipefail

# 输出 Cloud Run 扩缩容建议命令（不直接执行），根据 capacity-baseline 文档的预发建议。
# 用法：PROJECT=${GCP_PROJECT_ID} REGION=asia-northeast1 STACK=preview bash deployments/scripts/cloudrun-scaling-recommendations.sh

PROJECT=${PROJECT:-${GCP_PROJECT_ID}}
REGION=${REGION:-asia-northeast1}
STACK=${STACK:-preview}

svc() { echo "$1-$STACK"; }

cat <<'EOF'
# Browser-Exec（预热2，最大20，并发40）
gcloud run services update $(svc browser-exec) \
  --project=$PROJECT --region=$REGION \
  --min-instances=2 --max-instances=20 \
  --concurrency=40 --cpu=2 --memory=4Gi

# Adscenter（并发100，min 1）
gcloud run services update $(svc adscenter) \
  --project=$PROJECT --region=$REGION \
  --min-instances=1 --concurrency=100

# Siterank（并发80，min 1）
gcloud run services update $(svc siterank) \
  --project=$PROJECT --region=$REGION \
  --min-instances=1 --concurrency=80
EOF

echo "# 请在确认窗口执行上述命令。可根据实际负载调整 max-instances。"

