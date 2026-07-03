#!/bin/bash
# Test script for database migration using Cloud SQL Auth Proxy with Unix Socket

echo "🔧 Testing Cloud SQL Auth Proxy with Unix Socket..."

# Check if proxy binary exists
if [ ! -f "cloud_sql_proxy" ]; then
    echo "📥 Downloading Cloud SQL Auth Proxy..."
    wget -q https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64 -O cloud_sql_proxy
    chmod +x cloud_sql_proxy
fi

# Create Unix socket directory
mkdir -p /tmp/cloudsql

# Start Cloud SQL Auth Proxy with Unix Socket
echo "🚀 Starting Cloud SQL Auth Proxy with Unix Socket..."
./cloud_sql_proxy ${GCP_PROJECT_ID}:asia-northeast1:gm \
    --unix-socket /tmp/cloudsql \
    --credentials-file secrets/gcp_codex_dev.json &
PROXY_PID=$!

# Wait for proxy to start
echo "⏳ Waiting for proxy to start..."
sleep 10

# Test Unix socket connection
echo "🔍 Testing Unix socket connection..."
SOCKET_PATH="/tmp/cloudsql/${GCP_PROJECT_ID}:asia-northeast1:gm/.s.PGSQL.5432"

if [ -S "$SOCKET_PATH" ]; then
    echo "✅ Unix socket is ready at $SOCKET_PATH"

    # Test database connection via Unix socket
    echo "🔍 Testing database connection..."
    if PGPASSWORD='%24GL%28~x%5DT2Q%5BM' psql -h "$SOCKET_PATH" -U postgres -d gm_db -c "SELECT version();"; then
        echo "✅ Database connection successful via Unix socket"

        # Check migration status
        echo "📊 Checking migration status..."
        cd services/billing
        export DB_URL="postgresql://postgres:%24GL%28~x%5DT2Q%5BM@/gm_db?host=/tmp/cloudsql/${GCP_PROJECT_ID}:asia-northeast1:gm"

        # Install migrate if not present
        if ! command -v migrate &> /dev/null; then
            echo "📥 Installing golang-migrate..."
            brew install golang-migrate 2>/dev/null || {
                curl -L https://github.com/golang-migrate/migrate/releases/download/v4.16.2/migrate.darwin.amd64.tar.gz | tar -xz -C /usr/local/bin
                chmod +x /usr/local/bin/migrate
            }
        fi

        # Check current migration version
        migrate -path=migrations -database="$DB_URL" version

        # Execute pending migrations
        echo "🚀 Executing pending migrations..."
        if migrate -path=migrations -database="$DB_URL" up; then
            echo "✅ Migrations executed successfully"

            # Verify final status
            echo "📊 Final migration status:"
            migrate -path=migrations -database="$DB_URL" version
        else
            echo "❌ Migration execution failed"
        fi
    else
        echo "❌ Database connection failed"
    fi
else
    echo "❌ Unix socket not created"
    echo "Debugging info:"
    ls -la /tmp/cloudsql/ 2>/dev/null || echo "Socket directory does not exist"
    echo "Checking if proxy is running..."
    ps aux | grep cloud_sql_proxy || echo "Proxy process not found"
fi

# Clean up
echo "🧹 Cleaning up..."
kill $PROXY_PID 2>/dev/null
echo "✅ Test completed"