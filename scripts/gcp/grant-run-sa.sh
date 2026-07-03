#!/usr/bin/env bash
set -euo pipefail

# 简化版：为一组 Cloud Run 服务账号授予项目级常用角色。
# 使用：PROJECT_ID=${GCP_PROJECT_ID} ./scripts/gcp/grant-run-sa.sh <sa1@...> [sa2@... ...]

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-${PROJECT_ID:-}}"
REGION="${REGION:-asia-northeast1}"
if [[ -z "${PROJECT_ID}" ]]; then
  echo "Usage: PROJECT_ID=<id> [REGION=asia-northeast1] $0 [sa1@... sa2@...]" >&2
  exit 1
fi

SAS=("$@")

ROLES=(
  roles/secretmanager.secretAccessor
  roles/cloudsql.client
  roles/pubsub.editor
)

if [[ ${#SAS[@]} -eq 0 ]]; then
  echo "[grant] No SA provided; auto-detect from Cloud Run services in ${REGION}"
  mapfile -t services < <(gcloud run services list --region "${REGION}" --format='value(metadata.name)' || true)
  for svc in "${services[@]}"; do
    sa=$(gcloud run services describe "$svc" --region "${REGION}" --format='value(spec.template.spec.serviceAccount)' || true)
    if [[ -n "$sa" ]]; then
      echo "  - $svc uses SA: $sa"
      SAS+=("$sa")
    else
      echo "  - WARN: $svc has no explicit serviceAccount; it may use default compute SA"
    fi
  done
  if [[ ${#SAS[@]} -eq 0 ]]; then
    PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)' || true)
    if [[ -n "$PROJECT_NUMBER" ]]; then
      DEFAULT_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
      echo "  - Fallback default compute SA: ${DEFAULT_SA}"
      SAS+=("$DEFAULT_SA")
    fi
  fi
fi

# de-duplicate
if [[ ${#SAS[@]} -gt 0 ]]; then
  readarray -t SAS < <(printf "%s\n" "${SAS[@]}" | awk "NF && !seen[$0]++")
  for SA in "${SAS[@]}"; do
    echo "[grant] Project=${PROJECT_ID} SA=${SA}"
    for ROLE in "${ROLES[@]}"; do
      echo "  -> ${ROLE}"
      gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
        --member="serviceAccount:${SA}" \
        --role="${ROLE}" >/dev/null
    done
  done
else
  echo "[grant] No service accounts to grant"
fi

echo "[grant] Done"

