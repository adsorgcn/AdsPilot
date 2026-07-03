#!/bin/bash
# Local database migration script using Cloud SQL Proxy

set -e

echo "🚀 Starting database migration using Cloud SQL Proxy..."

# Download Cloud SQL Proxy if not exists
if [ ! -f "cloud_sql_proxy" ]; then
    echo "📥 Downloading Cloud SQL Auth Proxy..."
    wget -q https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64 -O cloud_sql_proxy
    chmod +x cloud_sql_proxy
fi

# Start Cloud SQL Proxy with TCP socket
echo "🔧 Starting Cloud SQL Auth Proxy..."
./cloud_sql_proxy ${GCP_PROJECT_ID}:asia-northeast1:gm \
    --port 5433 \
    --credentials-file secrets/gcp_codex_dev.json &
PROXY_PID=$!

# Wait for proxy to start
sleep 10

# Check if proxy is running
if ! kill -0 $PROXY_PID 2>/dev/null; then
    echo "❌ Cloud SQL Proxy failed to start"
    exit 1
fi

echo "✅ Cloud SQL Proxy started on port 5433"

# Test connection
echo "🔍 Testing database connection..."
if PGPASSWORD='%24GL%28~x%5DT2Q%5BM' psql -h localhost -p 5433 -U postgres -d gm_db -c "SELECT version();"; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed"
    kill $PROXY_PID 2>/dev/null
    exit 1
fi

# Execute migration
echo "📊 Executing database migration..."
cd services/billing

# Install migrate if not present
if ! command -v migrate &> /dev/null; then
    echo "📥 Installing golang-migrate..."
    brew install golang-migrate 2>/dev/null || {
        curl -L https://github.com/golang-migrate/migrate/releases/download/v4.16.2/migrate.darwin.amd64.tar.gz | tar -xz -C /usr/local/bin
        chmod +x /usr/local/bin/migrate
    }
fi

# Check current version
echo "📋 Current migration version:"
migrate -path=migrations -database="postgresql://postgres:%24GL%28~x%5DT2Q%5BM@localhost:5433/gm_db" version

# Execute migrations
echo "⚡ Executing pending migrations..."
if migrate -path=migrations -database="postgresql://postgres:%24GL%28~x%5DT2Q%5BM@localhost:5433/gm_db" up; then
    echo "✅ Migration executed successfully"
else
    echo "❌ Migration failed"
    kill $PROXY_PID 2>/dev/null
    exit 1
fi

# Final status
echo "📊 Final migration status:"
migrate -path=migrations -database="postgresql://postgres:%24GL%28~x%5DT2Q%5BM@localhost:5433/gm_db" version

# Cleanup
echo "🧹 Cleaning up..."
kill $PROXY_PID 2>/dev/null
echo "✅ Migration completed successfully"