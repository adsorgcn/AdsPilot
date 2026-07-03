#!/bin/sh
set -e

echo "=== Database Migration Entrypoint ==="

# Get DATABASE_URL from Secret Manager if SECRET_NAME is provided
if [ -n "$DATABASE_URL_SECRET_NAME" ]; then
    echo "Fetching DATABASE_URL from Secret Manager: $DATABASE_URL_SECRET_NAME"
    SECRET_NAME=$(echo "$DATABASE_URL_SECRET_NAME" | awk -F'/' '{print $4}')
    PROJECT_ID=$(echo "$DATABASE_URL_SECRET_NAME" | awk -F'/' '{print $2}')
    DATABASE_URL=$(gcloud secrets versions access latest --secret="$SECRET_NAME" --project="$PROJECT_ID")

    if [ -z "$DATABASE_URL" ]; then
        echo "ERROR: Failed to fetch DATABASE_URL from Secret Manager"
        exit 1
    fi
    echo "Successfully fetched DATABASE_URL from Secret Manager"
elif [ -n "$DATABASE_URL" ]; then
    echo "Using DATABASE_URL from environment variable"
else
    echo "ERROR: Neither DATABASE_URL_SECRET_NAME nor DATABASE_URL is set"
    exit 1
fi

# Default command is "up" if no arguments provided
MIGRATE_COMMAND="${@:-up}"

echo "Running migration command: $MIGRATE_COMMAND"
migrate -path=/migrations -database "$DATABASE_URL" -verbose $MIGRATE_COMMAND

MIGRATION_EXIT_CODE=$?

if [ $MIGRATION_EXIT_CODE -eq 0 ]; then
    echo "✓ Migration command completed successfully: $MIGRATE_COMMAND"
else
    echo "✗ Migration command failed with exit code $MIGRATION_EXIT_CODE: $MIGRATE_COMMAND"
    exit $MIGRATION_EXIT_CODE
fi
