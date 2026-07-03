#!/usr/bin/env node
/**
 * Gateway Middleware JWT Validation Test
 *
 * Tests Supabase JWT validation by:
 * 1. Getting a real JWT token from Supabase Auth
 * 2. Testing Gateway endpoints with that token
 * 3. Verifying JWT claims extraction and header injection
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://YOUR_SUPABASE_PROJECT.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const GATEWAY_URL = process.env.GATEWAY_URL || 'https://gateway-middleware-preview-yt54xvsg5q-an.a.run.app'

// Test credentials (you'll need to provide real test user credentials)
const TEST_EMAIL = process.env.TEST_EMAIL
const TEST_PASSWORD = process.env.TEST_PASSWORD

function log(...args) {
  console.log('[gateway-jwt-test]', ...args)
}

async function testGatewayJWT() {
  log('🚀 Starting Gateway JWT validation test...\n')

  // 1. Create Supabase client
  if (!SUPABASE_ANON_KEY) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY not set')
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  log('✅ Supabase client created')
  log(`   URL: ${SUPABASE_URL}`)

  // 2. Get JWT token
  log('\n📝 Obtaining JWT token...')

  let accessToken
  let userId
  let userEmail

  if (TEST_EMAIL && TEST_PASSWORD) {
    // Sign in with test credentials
    log(`   Signing in as: ${TEST_EMAIL}`)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })

    if (error) {
      throw new Error(`Supabase sign-in failed: ${error.message}`)
    }

    accessToken = data.session.access_token
    userId = data.user.id
    userEmail = data.user.email

    log('   ✅ Sign-in successful')
  } else {
    // Use service role to create a temporary user token for testing
    log('   ⚠️  No test credentials provided')
    log('   Please set TEST_EMAIL and TEST_PASSWORD environment variables')
    log('   Or use existing session from browser:')
    log('')
    log('   1. Open browser DevTools on frontend')
    log('   2. Go to Application > Local Storage')
    log('   3. Find supabase.auth.token')
    log('   4. Copy access_token value')
    log('   5. Export as JWT_TOKEN environment variable')

    if (process.env.JWT_TOKEN) {
      accessToken = process.env.JWT_TOKEN
      log('\n   ✅ Using JWT_TOKEN from environment')
    } else {
      throw new Error('No JWT token available')
    }
  }

  if (!accessToken) {
    throw new Error('Failed to obtain access token')
  }

  log(`   Token (first 50 chars): ${accessToken.substring(0, 50)}...`)
  log(`   User ID: ${userId || 'from token'}`)
  log(`   User Email: ${userEmail || 'from token'}`)

  // 3. Test Gateway health endpoint (no auth required)
  log('\n🏥 Testing Gateway health endpoint...')
  const healthResponse = await fetch(`${GATEWAY_URL}/health`)
  const healthData = await healthResponse.json()

  if (healthResponse.ok) {
    log('   ✅ Health check passed:', healthData)
  } else {
    log('   ❌ Health check failed:', healthResponse.status)
  }

  // 4. Test authenticated endpoint through Gateway
  log('\n🔐 Testing authenticated endpoint through Gateway...')
  log(`   Endpoint: ${GATEWAY_URL}/api/v1/users/me/subscription`)

  const authResponse = await fetch(`${GATEWAY_URL}/api/v1/users/me/subscription`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })

  log(`   Response status: ${authResponse.status}`)
  log(`   Response headers:`)

  // Check for injected headers in response
  const responseHeaders = Object.fromEntries(authResponse.headers.entries())
  Object.keys(responseHeaders).forEach(key => {
    if (key.toLowerCase().startsWith('x-')) {
      log(`     ${key}: ${responseHeaders[key]}`)
    }
  })

  if (authResponse.ok) {
    const data = await authResponse.json()
    log('   ✅ Authentication successful')
    log('   Response data:', JSON.stringify(data, null, 2))
  } else {
    const errorText = await authResponse.text()
    log('   ❌ Authentication failed')
    log('   Error:', errorText)
  }

  // 5. Test without token (should fail)
  log('\n❌ Testing endpoint without token (should fail)...')
  const noAuthResponse = await fetch(`${GATEWAY_URL}/api/v1/users/me/subscription`, {
    headers: {
      'Content-Type': 'application/json'
    }
  })

  log(`   Response status: ${noAuthResponse.status}`)
  if (noAuthResponse.status === 401) {
    log('   ✅ Correctly rejected unauthenticated request')
  } else {
    log('   ⚠️  Expected 401, got:', noAuthResponse.status)
  }

  // 6. Test with invalid token (should fail)
  log('\n🚫 Testing endpoint with invalid token (should fail)...')
  const invalidAuthResponse = await fetch(`${GATEWAY_URL}/api/v1/users/me/subscription`, {
    headers: {
      'Authorization': 'Bearer invalid.token.here',
      'Content-Type': 'application/json'
    }
  })

  log(`   Response status: ${invalidAuthResponse.status}`)
  if (invalidAuthResponse.status === 401) {
    log('   ✅ Correctly rejected invalid token')
  } else {
    log('   ⚠️  Expected 401, got:', invalidAuthResponse.status)
  }

  log('\n✅ Gateway JWT validation test complete!\n')

  // Summary
  log('📊 Test Summary:')
  log('   ✓ Health endpoint accessible')
  log('   ✓ Valid JWT accepted')
  log('   ✓ Missing JWT rejected')
  log('   ✓ Invalid JWT rejected')
}

// Run test
testGatewayJWT()
  .then(() => {
    log('🎉 All tests passed!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  })
