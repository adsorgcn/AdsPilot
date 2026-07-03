#!/usr/bin/env bash
set -euo pipefail

# GCP infra verification (read-only)
# - Activates service account
# - Lists Secret Manager keys (names only)
# - Lists Cloud Run services (+ env var names/secret mounts)
# - Lists API Gateway gateways/APIs/configs
# - Lists Pub/Sub topics/subscriptions

PROJECT_ID="${PROJECT_ID:-${GCP_PROJECT_ID}}"
REGION="${REGION:-asia-northeast1}"
SA_EMAIL="${SA_EMAIL:-codex-dev@${GCP_PROJECT_ID}.iam.gserviceaccount.com}"
KEY_FILE="${KEY_FILE:-secrets/gcp_codex_dev.json}"

echo "== Using project: ${PROJECT_ID} / region: ${REGION} =="

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud not found; please install Google Cloud SDK" >&2
  exit 127
fi

echo "Activating service account: ${SA_EMAIL}"
gcloud --quiet auth activate-service-account "${SA_EMAIL}" --key-file="${KEY_FILE}" --project="${PROJECT_ID}"
gcloud --quiet config set project "${PROJECT_ID}"
gcloud --quiet config set run/region "${REGION}"

echo
echo "== Secret Manager (names only) =="
gcloud secrets list --project "${PROJECT_ID}" --format='table(name,labels)'

echo
echo "== Cloud Run services =="
gcloud run services list --platform=managed --region "${REGION}" --format='table(metadata.name,status.url)'

KNOWN_SERVICES=(adscenter offer siterank billing batchopen console notifications recommendations frontend)
for svc in "${KNOWN_SERVICES[@]}"; do
  if gcloud run services describe "$svc" --region "$REGION" --format='get(metadata.name)' >/dev/null 2>&1; then
    echo
    echo "-- ${svc} (env names / secret mounts) --"
    gcloud run services describe "$svc" --region "$REGION" \
      --format='yaml(spec.template.spec.containers[0].env, spec.template.spec.containers[0].envFrom, spec.template.spec.containers[0].volumeMounts, spec.template.spec.volumes)'
  fi
done

echo
echo "== API Gateway (gateways) =="
gcloud api-gateway gateways list --project "${PROJECT_ID}" --format='table(name,defaultHostname,state)'

echo
echo "== API Gateway (APIs/configs) =="
gcloud api-gateway apis list --project "${PROJECT_ID}" --format='value(name)' | while read -r api; do
  [ -z "$api" ] && continue
  echo "-- ${api} configs --"
  gcloud api-gateway api-configs list --api="$api" --project "${PROJECT_ID}" --format='table(name,state)'
done

echo
echo "== Pub/Sub topics =="
gcloud pubsub topics list --project "${PROJECT_ID}" --format='table(name)'

echo
echo "== Pub/Sub subscriptions =="
gcloud pubsub subscriptions list --project "${PROJECT_ID}" --format='table(name,topic)'

echo
echo "Done."
