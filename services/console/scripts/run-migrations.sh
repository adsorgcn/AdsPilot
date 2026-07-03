#!/bin/bash
# Console Database Migration Runner
# Usage: ./scripts/run-migrations.sh [local|cloud]

set -e

MODE="${1:-local}"

case "$MODE" in
  local)
    echo "🔧 Running migrations locally..."

    # Check if DATABASE_URL is set
    if [ -z "$DATABASE_URL" ]; then
      echo "❌ DATABASE_URL environment variable is required"
      exit 1
    fi

    # Build migration binary
    echo "→ Building migration binary..."
    cd "$(dirname "$0")/.."
    go build -o /tmp/console-migrate ./cmd/migrate

    # Run migrations
    echo "→ Running migrations..."
    MIGRATIONS_DIR=./migrations /tmp/console-migrate

    echo "✅ Local migrations completed"
    ;;

  cloud)
    echo "☁️  Running migrations on Cloud Run Jobs..."

    # Check if PROJECT_ID is set
    PROJECT_ID="${PROJECT_ID:-${GCP_PROJECT_ID}}"

    # Submit Cloud Build
    echo "→ Submitting Cloud Build..."
    gcloud builds submit \
      --config cloudbuild.migrate.yaml \
      --project "$PROJECT_ID" \
      --substitutions SHORT_SHA=$(git rev-parse --short HEAD)

    echo "✅ Cloud migrations completed"
    ;;

  *)
    echo "❌ Invalid mode: $MODE"
    echo "Usage: $0 [local|cloud]"
    exit 1
    ;;
esac
