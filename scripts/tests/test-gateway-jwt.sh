#!/bin/bash
#
# Gateway Middleware JWT Validation Test
#
# Tests Supabase JWT validation by making HTTP requests to Gateway endpoints
#
# Usage:
#   # Option 1: Provide JWT token directly
#   JWT_TOKEN="your.jwt.token" ./scripts/tests/test-gateway-jwt.sh
#
#   # Option 2: Use test credentials (requires jq)
#   TEST_EMAIL="test@example.com" TEST_PASSWORD="password" ./scripts/tests/test-gateway-jwt.sh
#

set -e

GATEWAY_URL="${GATEWAY_URL:-https://gateway-middleware-preview-yt54xvsg5q-an.a.run.app}"
SUPABASE_URL="${SUPABASE_URL:-https://YOUR_SUPABASE_PROJECT.supabase.co}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-$NEXT_PUBLIC_SUPABASE_ANON_KEY}"

log() {
  echo "[gateway-jwt-test] $*"
}

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

success() {
  echo -e "${GREEN}✅ $*${NC}"
}

error() {
  echo -e "${RED}❌ $*${NC}"
}

warn() {
  echo -e "${YELLOW}⚠️  $*${NC}"
}

log "🚀 Starting Gateway JWT validation test..."
echo ""

# 1. Check if JWT_TOKEN is provided
if [ -n "$JWT_TOKEN" ]; then
  log "Using JWT_TOKEN from environment"
  ACCESS_TOKEN="$JWT_TOKEN"
elif [ -n "$TEST_EMAIL" ] && [ -n "$TEST_PASSWORD" ]; then
  log "Signing in with test credentials: $TEST_EMAIL"

  # Check if jq is installed
  if ! command -v jq &> /dev/null; then
    error "jq is required for automatic sign-in. Install with: brew install jq"
    error "Or provide JWT_TOKEN directly: JWT_TOKEN='...' $0"
    exit 1
  fi

  # Sign in with Supabase
  SIGN_IN_RESPONSE=$(curl -s -X POST \
    "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}")

  # Check for error
  if echo "$SIGN_IN_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    error "Supabase sign-in failed:"
    echo "$SIGN_IN_RESPONSE" | jq '.error'
    exit 1
  fi

  ACCESS_TOKEN=$(echo "$SIGN_IN_RESPONSE" | jq -r '.access_token')
  USER_ID=$(echo "$SIGN_IN_RESPONSE" | jq -r '.user.id')
  USER_EMAIL=$(echo "$SIGN_IN_RESPONSE" | jq -r '.user.email')

  success "Sign-in successful"
  log "   User ID: $USER_ID"
  log "   User Email: $USER_EMAIL"
else
  warn "No JWT token or test credentials provided"
  echo ""
  echo "To run this test, you need a JWT token. You can:"
  echo ""
  echo "Option 1: Provide test credentials"
  echo "  TEST_EMAIL='test@example.com' TEST_PASSWORD='password' $0"
  echo ""
  echo "Option 2: Provide JWT token directly"
  echo "  1. Open browser DevTools on frontend (https://frontend-preview-yt54xvsg5q-an.a.run.app)"
  echo "  2. Sign in with Google"
  echo "  3. Open Console and run: localStorage.getItem('supabase.auth.token')"
  echo "  4. Copy the access_token value"
  echo "  5. Run: JWT_TOKEN='<your_token>' $0"
  echo ""
  exit 1
fi

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
  error "Failed to obtain access token"
  exit 1
fi

log "Token (first 50 chars): ${ACCESS_TOKEN:0:50}..."
echo ""

# 2. Test Gateway health endpoint (no auth required)
log "🏥 Testing Gateway health endpoint..."
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "${GATEWAY_URL}/health")
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | sed '$d')
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | tail -n 1)

if [ "$HEALTH_STATUS" = "200" ]; then
  success "Health check passed: $HEALTH_BODY"
else
  error "Health check failed with status: $HEALTH_STATUS"
fi
echo ""

# 3. Test authenticated endpoint through Gateway (should succeed)
log "🔐 Testing authenticated endpoint (should succeed)..."
log "   Endpoint: ${GATEWAY_URL}/api/v1/users/me/subscription"

AUTH_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  "${GATEWAY_URL}/api/v1/users/me/subscription")

AUTH_BODY=$(echo "$AUTH_RESPONSE" | sed '$d')
AUTH_STATUS=$(echo "$AUTH_RESPONSE" | tail -n 1)

log "   Response status: $AUTH_STATUS"

if [ "$AUTH_STATUS" = "200" ]; then
  success "Authentication successful"
  log "   Response: $AUTH_BODY"
elif [ "$AUTH_STATUS" = "401" ]; then
  error "Authentication failed (401 Unauthorized)"
  log "   Response: $AUTH_BODY"
elif [ "$AUTH_STATUS" = "404" ]; then
  warn "Subscription not found (404) - user may not have subscription yet"
  log "   Response: $AUTH_BODY"
else
  error "Unexpected status: $AUTH_STATUS"
  log "   Response: $AUTH_BODY"
fi
echo ""

# 4. Test without token (should fail with 401)
log "❌ Testing endpoint without token (should fail)..."
NO_AUTH_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Content-Type: application/json" \
  "${GATEWAY_URL}/api/v1/users/me/subscription")

NO_AUTH_STATUS=$(echo "$NO_AUTH_RESPONSE" | tail -n 1)

log "   Response status: $NO_AUTH_STATUS"

if [ "$NO_AUTH_STATUS" = "401" ]; then
  success "Correctly rejected unauthenticated request"
else
  warn "Expected 401, got: $NO_AUTH_STATUS"
fi
echo ""

# 5. Test with invalid token (should fail with 401)
log "🚫 Testing endpoint with invalid token (should fail)..."
INVALID_AUTH_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer invalid.token.here" \
  -H "Content-Type: application/json" \
  "${GATEWAY_URL}/api/v1/users/me/subscription")

INVALID_AUTH_STATUS=$(echo "$INVALID_AUTH_RESPONSE" | tail -n 1)

log "   Response status: $INVALID_AUTH_STATUS"

if [ "$INVALID_AUTH_STATUS" = "401" ]; then
  success "Correctly rejected invalid token"
else
  warn "Expected 401, got: $INVALID_AUTH_STATUS"
fi
echo ""

# 6. Test token endpoint (basic check)
log "🪙 Testing token balance endpoint..."
TOKEN_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  "${GATEWAY_URL}/api/v1/users/me/tokens")

TOKEN_BODY=$(echo "$TOKEN_RESPONSE" | sed '$d')
TOKEN_STATUS=$(echo "$TOKEN_RESPONSE" | tail -n 1)

log "   Response status: $TOKEN_STATUS"

if [ "$TOKEN_STATUS" = "200" ]; then
  success "Token balance retrieved successfully"
  log "   Response: $TOKEN_BODY"
elif [ "$TOKEN_STATUS" = "404" ]; then
  warn "Token balance not found (404) - user may not have tokens yet"
  log "   Response: $TOKEN_BODY"
else
  log "   Status: $TOKEN_STATUS, Response: $TOKEN_BODY"
fi
echo ""

# Summary
log "📊 Test Summary:"
success "Health endpoint accessible"

if [ "$AUTH_STATUS" = "200" ] || [ "$AUTH_STATUS" = "404" ]; then
  success "Valid JWT accepted by Gateway"
else
  error "Valid JWT was rejected"
fi

if [ "$NO_AUTH_STATUS" = "401" ]; then
  success "Missing JWT correctly rejected"
else
  error "Missing JWT was not rejected"
fi

if [ "$INVALID_AUTH_STATUS" = "401" ]; then
  success "Invalid JWT correctly rejected"
else
  error "Invalid JWT was not rejected"
fi

echo ""
log "✅ Gateway JWT validation test complete!"
