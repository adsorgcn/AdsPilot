#!/usr/bin/env bash
set -euo pipefail

# Ensure Cloud SQL database and user exist, and publish DATABASE_URL secret version.
# Requirements: gcloud, permissions for Cloud SQL Admin + Secret Manager.

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-${PROJECT_ID:-}}"
INSTANCE="${CLOUDSQL_INSTANCE:-${CLOUDSQL_INSTANCE_NAME:-gm}}"
DB_NAME="${DB_NAME:-gm_db}"
DB_USER="${DB_USER:-gm_app}"
DB_PASSWORD="${DB_PASSWORD:-}"
DATABASE_URL_SECRET_NAME="${DATABASE_URL_SECRET_NAME:-}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "[sql-ensure] ERROR: set GOOGLE_CLOUD_PROJECT/PROJECT_ID" >&2
  exit 1
fi
gcloud config set project "${PROJECT_ID}" >/dev/null

echo "[sql-ensure] Instance: ${INSTANCE} | DB: ${DB_NAME} | User: ${DB_USER}"

if ! gcloud sql instances describe "${INSTANCE}" >/dev/null 2>&1; then
  echo "[sql-ensure] ERROR: Cloud SQL instance '${INSTANCE}' does not exist. Please create it first." >&2
  exit 2
fi

if ! gcloud sql databases describe "${DB_NAME}" --instance "${INSTANCE}" >/dev/null 2>&1; then
  echo "[sql-ensure] Creating database: ${DB_NAME}"
  gcloud sql databases create "${DB_NAME}" --instance "${INSTANCE}"
else
  echo "[sql-ensure] Database exists"
fi

if ! gcloud sql users list --instance "${INSTANCE}" --filter="name=${DB_USER}" --format="value(name)" | grep -qx "${DB_USER}"; then
  if [[ -z "${DB_PASSWORD}" ]]; then
    echo "[sql-ensure] Generating random password for ${DB_USER}"
    DB_PASSWORD="$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24)"
  fi
  echo "[sql-ensure] Creating user: ${DB_USER}"
  gcloud sql users create "${DB_USER}" --instance "${INSTANCE}" --password "${DB_PASSWORD}"
else
  echo "[sql-ensure] User exists"
fi

if [[ -n "${DATABASE_URL_SECRET_NAME}" ]]; then
  # Compose a DSN using cloudsql-proxy host for local dev
  local_dsn="postgres://${DB_USER}:${DB_PASSWORD}@cloudsql-proxy:5432/${DB_NAME}?sslmode=disable"
  echo "[sql-ensure] Adding DATABASE_URL secret version"
  SECRET_ID=${DATABASE_URL_SECRET_NAME#projects/*/secrets/}
  SECRET_ID=${SECRET_ID%%/versions/*}
  if ! gcloud secrets describe "${SECRET_ID}" >/dev/null 2>&1; then
    gcloud secrets create "${SECRET_ID}" --replication-policy=automatic
  fi
  printf "%s" "${local_dsn}" | gcloud secrets versions add "${SECRET_ID}" --data-file=- >/dev/null
else
  echo "[sql-ensure] NOTE: DATABASE_URL_SECRET_NAME not provided; skip secret update"
fi

echo "[sql-ensure] Done"

