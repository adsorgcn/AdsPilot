#!/bin/bash
# Test script for database migration using Cloud SQL Auth Proxy

echo "🔧 Testing Cloud SQL Auth Proxy connection..."

# Check if proxy binary exists
if [ ! -f "cloud_sql_proxy" ]; then
    echo "📥 Downloading Cloud SQL Auth Proxy..."
    wget -q https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64 -O cloud_sql_proxy
    chmod +x cloud_sql_proxy
fi

# Start Cloud SQL Auth Proxy in background
echo "🚀 Starting Cloud SQL Auth Proxy..."
./cloud_sql_proxy ${GCP_PROJECT_ID}:asia-northeast1:gm \
    --port 5432 \
    --private-ip \
    --credentials-file secrets/gcp_codex_dev.json &
PROXY_PID=$!

# Wait for proxy to start
echo "⏳ Waiting for proxy to start..."
sleep 10

# Test connection
echo "🔍 Testing connection..."
if nc -z localhost 5432; then
    echo "✅ Cloud SQL Auth Proxy is running on localhost:5432"

    # Test database connection
    echo "🔍 Testing database connection..."
    if PGPASSWORD='%24GL%28~x%5DT2Q%5BM' psql -h localhost -U postgres -d gm_db -c "SELECT version();"; then
        echo "✅ Database connection successful via Cloud SQL Auth Proxy"

        # Check migration status
        echo "📊 Checking migration status..."
        cd services/billing
        migrate -path=migrations -database="postgresql://postgres:%24GL%28~x%5DT2Q%5BM@localhost:5432/gm_db" version
    else
        echo "❌ Database connection failed"
    fi
else
    echo "❌ Cloud SQL Auth Proxy failed to start"
fi

# Clean up
echo "🧹 Cleaning up..."
kill $PROXY_PID 2>/dev/null
echo "✅ Test completed"