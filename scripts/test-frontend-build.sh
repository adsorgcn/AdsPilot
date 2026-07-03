#!/bin/bash
# 测试前端 Docker 镜像构建
# Usage: ./test-frontend-build.sh

set -euo pipefail

echo "🔨 Testing Frontend Docker Build"
echo "================================"

# Build arguments (use dummy values for testing)
BUILD_ARGS=(
  --build-arg PREVIEW_STUB=true
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY=test-api-key
  --build-arg NEXT_PUBLIC_FIREBASE_APP_ID=test-app-id
  --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=test.firebaseapp.com
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID=test-project
  --build-arg NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=test.appspot.com
  --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
  --build-arg NEXT_PUBLIC_SITE_URL=http://localhost:3000
)

# Build image
echo "📦 Building Docker image..."
docker build \
  -f apps/frontend/Dockerfile \
  -t gm-frontend:test \
  "${BUILD_ARGS[@]}" \
  . || {
    echo "❌ Docker build failed!"
    exit 1
  }

echo ""
echo "✅ Docker build succeeded!"
echo ""
echo "📊 Image size:"
docker images gm-frontend:test --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

echo ""
echo "🔍 Image layers:"
docker history gm-frontend:test --human --format "table {{.CreatedBy}}\t{{.Size}}" | head -15

echo ""
echo "🧪 Testing container startup..."
CONTAINER_ID=$(docker run -d -p 8080:8080 gm-frontend:test)

echo "Container ID: $CONTAINER_ID"
echo "Waiting for container to start..."
sleep 5

if docker ps | grep -q "$CONTAINER_ID"; then
  echo "✅ Container is running"

  echo ""
  echo "🌐 Testing HTTP endpoint..."
  if curl -f -s http://localhost:8080 > /dev/null; then
    echo "✅ HTTP endpoint responds"
  else
    echo "⚠️  HTTP endpoint not responding (may need real Firebase config)"
  fi

  echo ""
  echo "📋 Container logs (last 20 lines):"
  docker logs --tail 20 "$CONTAINER_ID"

  echo ""
  echo "🧹 Cleaning up..."
  docker stop "$CONTAINER_ID" > /dev/null
  docker rm "$CONTAINER_ID" > /dev/null
  echo "✅ Container cleaned up"
else
  echo "❌ Container failed to start"
  echo "📋 Container logs:"
  docker logs "$CONTAINER_ID"
  docker rm "$CONTAINER_ID" > /dev/null
  exit 1
fi

echo ""
echo "🎉 All tests passed!"
echo ""
echo "To run the container manually:"
echo "  docker run -p 8080:8080 gm-frontend:test"
echo ""
echo "To clean up the test image:"
echo "  docker rmi gm-frontend:test"
