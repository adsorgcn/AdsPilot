#!/bin/bash
# Test connection to Cloud SQL private IP through VPC Connector

echo "🔍 Testing connection to Cloud SQL private IP (10.6.0.2)..."

# Test 1: Ping
echo "1. Testing ping..."
if ping -c 3 10.6.0.2; then
    echo "✅ Ping successful"
else
    echo "❌ Ping failed"
fi

# Test 2: Port connectivity
echo "2. Testing port 5432..."
if nc -zv 10.6.0.2 5432; then
    echo "✅ Port 5432 is accessible"
else
    echo "❌ Port 5432 is not accessible"
fi

# Test 3: PostgreSQL connection
echo "3. Testing PostgreSQL connection..."
PGPASSWORD='%24GL%28~x%5DT2Q%5BM' psql -h 10.6.0.2 -U postgres -d gm_db -c "SELECT version();"

if [ $? -eq 0 ]; then
    echo "✅ PostgreSQL connection successful"

    # Test 4: Migration status
    echo "4. Checking migration status..."
    cd services/billing
    migrate -path=migrations -database="postgresql://postgres:%24GL%28~x%5DT2Q%5BM@10.6.0.2:5432/gm_db" version
else
    echo "❌ PostgreSQL connection failed"
fi

echo "✅ Test completed"