/**
 * API Fixes Validation Script
 *
 * Tests the fixed API endpoints to ensure they return the correct format
 * Run this in browser console on https://www.urlchecker.dev
 */

// Test API endpoints after format fixes
async function testAPIFixes() {
  console.log('🧪 Testing API Format Fixes...\n');

  const tests = [
    {
      name: 'Subscription API',
      url: '/api/v1/billing/subscriptions/me',
      expectedFields: ['tier', 'isActive', 'isElite', 'canUseAI', 'monthlyTokenAllocation']
    },
    {
      name: 'Token Balance API',
      url: '/api/v1/billing/tokens/balance',
      expectedFields: ['currentBalance', 'totalConsumed', 'totalGranted', 'lastUpdated']
    },
    {
      name: 'Offers List API',
      url: '/api/v1/offers',
      expectedFields: ['items', 'total', 'totalPages']
    },
    {
      name: 'Dashboard Stats API',
      url: '/api/v1/console/dashboard/stats',
      expectedFields: ['userId', 'totalOffers', 'evaluatedOffers', 'tokensRemaining']
    },
    {
      name: 'Check-in Status API',
      url: '/api/v1/check-in/status',
      expectedFields: ['hasCheckedInToday', 'currentStreak', 'totalCheckins']
    },
    {
      name: 'Ads Accounts API',
      url: '/api/v1/adscenter/accounts',
      expectedFields: ['items', 'total', 'totalPages']
    }
  ];

  const results = {
    passed: 0,
    failed: 0,
    details: []
  };

  for (const test of tests) {
    try {
      console.log(`🔍 Testing ${test.name}...`);

      const response = await fetch(test.url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const missingFields = [];
      const extraFields = [];

      // Check expected fields
      for (const field of test.expectedFields) {
        if (!(field in data)) {
          missingFields.push(field);
        }
      }

      // Check for field name mismatches
      const commonMismatches = {
        'planName': 'tier',
        'status': 'isActive',
        'balance': 'currentBalance',
        'totalCount': 'total',
        'streak': 'currentStreak'
      };

      for (const [backend, frontend] of Object.entries(commonMismatches)) {
        if (backend in data && !(frontend in data)) {
          extraFields.push(`${backend} -> should be ${frontend}`);
        }
      }

      const success = missingFields.length === 0 && extraFields.every(f => f.includes('->'));

      if (success) {
        console.log(`✅ ${test.name} - PASSED`);
        results.passed++;
      } else {
        console.log(`❌ ${test.name} - FAILED`);
        console.log(`   Missing fields: ${missingFields.join(', ')}`);
        console.log(`   Field mapping issues: ${extraFields.join(', ')}`);
        results.failed++;
      }

      results.details.push({
        name: test.name,
        success,
        missingFields,
        extraFields,
        dataKeys: Object.keys(data)
      });

    } catch (error) {
      console.log(`❌ ${test.name} - ERROR: ${error.message}`);
      results.failed++;
      results.details.push({
        name: test.name,
        success: false,
        error: error.message
      });
    }
  }

  // Summary
  console.log('\n📊 Test Results Summary');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${results.passed + results.failed}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Success Rate: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);

  if (results.failed === 0) {
    console.log('\n🎉 All API format fixes are working correctly!');
  } else {
    console.log('\n⚠️ Some APIs still need attention:');
    results.details
      .filter(d => !d.success)
      .forEach(d => {
        console.log(`   - ${d.name}: ${d.error || 'Field format issues'}`);
      });
  }

  return results;
}

// Export for manual testing
if (typeof window !== 'undefined') {
  window.testAPIFixes = testAPIFixes;
  console.log('💡 Run testAPIFixes() in console to test API format fixes');
}

// Auto-run if executed as script
if (typeof window === 'undefined') {
  testAPIFixes().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  });
}

export { testAPIFixes };