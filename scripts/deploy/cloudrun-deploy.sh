#!/usr/bin/env bash
set -euo pipefail

# Cloud Run 一键部署脚本（基于 Cloud Build 构建 + Artifact Registry + Cloud Run）
# 先决条件：已登录 gcloud，具备 Artifact Registry、Cloud Build、Run 权限
# 安全更新策略：默认使用 --update-env-vars，避免覆盖已有的 secrets/env（如 DATABASE_URL_SECRET_NAME）

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-${PROJECT_ID:-${GCP_PROJECT_ID}}}"
REGION="${REGION:-asia-northeast1}"
REPO="${REPO:-gm-services}"
BUILD_LOG_BUCKET="${BUILD_LOG_BUCKET:-gs://gm-build-logs-asia-northeast1}"
STACK="${STACK:-prod}"
RUN_SA="${RUN_SA:-codex-dev@${GCP_PROJECT_ID}.iam.gserviceaccount.com}"

# 支持仅部署变更的服务：
# - 如果设置了环境变量 SERVICES（逗号或空格分隔），则按其部署
# - 否则默认部署全量列表
if [[ -n "${SERVICES:-}" ]]; then
  # 兼容逗号或空格
  IFS=', ' read -r -a SERVICES_ARR <<< "${SERVICES}"
else
  SERVICES_ARR=(billing offer siterank adscenter batchopen console recommendations notifications)
fi

gcloud config set project "${PROJECT_ID}" >/dev/null
gcloud auth configure-docker "${REGION}-docker.pkg.dev" >/dev/null

for name in "${SERVICES_ARR[@]}"; do
  echo "[run-deploy] Building ${name} (root context, service Dockerfile)"
  IMAGE_TAG="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${name}:latest"
  TMP_DIR="scripts/deploy/_tmp"
  mkdir -p "${TMP_DIR}"
  CB_FILE="${TMP_DIR}/cloudbuild-${name}.yaml"
  if [[ "${name}" == "frontend" ]]; then
cat > "${CB_FILE}" <<EOF
steps:
- name: 'gcr.io/cloud-builders/docker'
  dir: 'apps/frontend'
  args: ['build','-f','Dockerfile','-t','${IMAGE_TAG}','.']
images: ['${IMAGE_TAG}']
EOF
  else
cat > "${CB_FILE}" <<EOF
steps:
- name: 'gcr.io/cloud-builders/docker'
  args: ['build','-f','services/${name}/Dockerfile','-t','${IMAGE_TAG}','.']
images: ['${IMAGE_TAG}']
EOF
  fi
  gcloud builds submit . --config "${CB_FILE}" --gcs-log-dir "${BUILD_LOG_BUCKET}" --region=global

  echo "[run-deploy] Deploy ${name}"
  ENVS="ENV=production,STACK=${STACK},GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GIN_MODE=release,PUBSUB_TOPIC_ID=domain-events-${STACK},PUBSUB_SUBSCRIPTION_ID=${name}-sub-${STACK}"
  if [[ "${name}" == "frontend" ]]; then
    if [[ -z "${GATEWAY_HOST:-}" ]]; then echo "[warn] GATEWAY_HOST not set; frontend will use default BACKEND_URL"; fi
    ENVS="NEXT_PUBLIC_DEPLOYMENT_ENV=production,NEXT_PUBLIC_FIREBASE_PROJECT_ID=${PROJECT_ID},BACKEND_URL=${GATEWAY_HOST:+https://${GATEWAY_HOST}},${ENVS}"
  fi
  # Optional: if you need to force set secrets for services that read DATABASE_URL directly
  # set FORCE_SET_SECRETS=1 in your environment. By default we preserve existing secret mounts.
  SET_SECRETS_ARGS=()
  if [[ "${FORCE_SET_SECRETS:-0}" == "1" ]]; then
    # Only set DATABASE_URL secret for services that rely on it directly.
    SET_SECRETS_ARGS+=("--set-secrets=DATABASE_URL=projects/${PROJECT_ID}/secrets/DATABASE_URL:latest")
  fi

  if [[ ${#SET_SECRETS_ARGS[@]} -gt 0 ]]; then
    gcloud run deploy "${name}" \
      --image "${IMAGE_TAG}" \
      --region "${REGION}" \
      --platform managed \
      --service-account "${RUN_SA}" \
      --allow-unauthenticated \
      --update-env-vars "${ENVS}" \
      "${SET_SECRETS_ARGS[@]}" \
      --vpc-connector cr-conn-default-ane1 \
      --vpc-egress private-ranges-only \
      --timeout=300s \
      
  else
    gcloud run deploy "${name}" \
      --image "${IMAGE_TAG}" \
      --region "${REGION}" \
      --platform managed \
      --service-account "${RUN_SA}" \
      --allow-unauthenticated \
      --update-env-vars "${ENVS}" \
      --vpc-connector cr-conn-default-ane1 \
      --vpc-egress private-ranges-only \
      --timeout=300s \
      
  fi
    
done

echo "[run-deploy] Done"
