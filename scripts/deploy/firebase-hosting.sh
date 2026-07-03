#!/usr/bin/env bash
set -euo pipefail

# Deploy Next.js (apps/frontend) to Firebase Hosting with SSR (Frameworks)
# Requirements:
#  - secrets/firebase-adminsdk.json: service account for firebase-adminsdk-fbsvc@${GCP_PROJECT_ID}.iam.gserviceaccount.com
#  - API_GATEWAY_HOST env: e.g. gm-gw-885pd7lz.an.gateway.dev
#  - PROJECT_ID env (default: ${GCP_PROJECT_ID})

PROJECT_ID=${PROJECT_ID:-${GCP_PROJECT_ID}}
GATEWAY=${API_GATEWAY_HOST:?API_GATEWAY_HOST required, e.g. gm-gw-xxxx.an.gateway.dev}

export GOOGLE_APPLICATION_CREDENTIALS=${GOOGLE_APPLICATION_CREDENTIALS:-$(pwd)/secrets/firebase-adminsdk.json}
if [[ ! -f "$GOOGLE_APPLICATION_CREDENTIALS" ]]; then
  echo "[err] Service account json not found at $GOOGLE_APPLICATION_CREDENTIALS" >&2
  exit 2
fi

pushd apps/frontend >/dev/null

# Install deps and export build-time environment variables (Next inlines process.env.* at build)
export NEXT_PUBLIC_DEPLOYMENT_ENV=${NEXT_PUBLIC_DEPLOYMENT_ENV:-production}
export NEXT_PUBLIC_FIREBASE_PROJECT_ID=${PROJECT_ID}
export NEXT_PUBLIC_FIRESTORE_DB_ID=${NEXT_PUBLIC_FIRESTORE_DB_ID:-firestoredb}
export BACKEND_URL="https://${GATEWAY}"

# Required Firebase Web SDK vars
REQUIRED=(
  NEXT_PUBLIC_FIREBASE_API_KEY
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  NEXT_PUBLIC_FIREBASE_APP_ID
)
missing=()
for k in "${REQUIRED[@]}"; do
  v=$(eval echo "\${$k:-}")
  if [[ -z "$v" ]]; then missing+=("$k"); fi
done
if (( ${#missing[@]} > 0 )); then
  echo "[err] Missing required env vars: ${missing[*]}" >&2
  echo "      Provide them via environment or apps/frontend/.env.local before deploy." >&2
  exit 3
fi

echo "[info] Installing frontend deps (fallback to npm install if lock mismatch)"
if ! npm ci; then
  npm install --no-audit --no-fund
fi

popd >/dev/null

echo "[info] Deploying to Firebase Hosting (project: ${PROJECT_ID})"
# Use a fixed firebase-tools version known to work in this environment
firebase --version >/dev/null 2>&1 || npx --yes firebase-tools@14.17.0 --version >/dev/null
if command -v firebase >/dev/null 2>&1; then
  echo "[info] Enabling webframeworks experiment"
  firebase experiments:enable webframeworks || true
  firebase deploy --only hosting --project "${PROJECT_ID}"
else
  echo "[info] Enabling webframeworks experiment"
  npx --yes firebase-tools@14.17.0 experiments:enable webframeworks || true
  npx --yes firebase-tools@14.17.0 deploy --only hosting --project "${PROJECT_ID}"
fi

echo "[done] Deployed. Visit https://${PROJECT_ID}.web.app"
