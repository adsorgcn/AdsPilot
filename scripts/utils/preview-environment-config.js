/**
 * Preview Environment Testing Configuration
 * Direct testing of www.urlchecker.dev without local setup
 */

// Preview Environment Configuration
const PREVIEW_CONFIG = {
  baseUrl: 'https://www.urlchecker.dev',
  apiBaseUrl: 'https://gateway-middleware-preview-yt54xvsg5q-an.a.run.app',
  environment: 'preview',
  branch: 'main',
  deploymentTarget: 'asia-northeast1',

  // Test accounts for preview environment
  testAccounts: {
    regular: {
      email: 'test@urlchecker.dev',
      password: process.env.TEST_PASSWORD || 'TestPassword123!'
    },
    admin: {
      email: 'admin@urlchecker.dev',
      password: process.env.ADMIN_PASSWORD || 'AdminPassword123!'
    },
    trial: {
      email: 'trial@urlchecker.dev',
      password: process.env.TRIAL_PASSWORD || 'TrialPassword123!'
    }
  },

  // Testing timeouts (preview environment allows faster testing)
  timeouts: {
    default: 30000,      // 30 seconds
    critical: 60000,    // 1 minute
    subscription: 45000, // 45 seconds
    performance: 120000 // 2 minutes
  },

  // Preview environment characteristics
  characteristics: {
    allowsDataLoss: true,           // Preview allows data reset
    aggressiveUpdates: true,        // Fast updates acceptable
    autoSchemaRebuild: true,         // Auto-rebuild schemas
    testingMode: true,               // Testing mode enabled
    bypassAuthForTesting: false      // Require real auth
  },

  // Service endpoints for testing
  services: {
    frontend: 'https://www.urlchecker.dev',
    api: 'http://api.urlchecker.dev',
    billing: 'http://api.urlchecker.dev/billing',
    offer: 'http://api.urlchecker.dev/offer',
    siterank: 'http://api.urlchecker.dev/siterank',
    useractivity: 'http://api.urlchecker.dev/useractivity',
    console: 'http://api.urlchecker.dev/console',
    gateway: 'http://api.urlchecker.dev',
    adscenter: 'http://api.urlchecker.dev/adscenter'
  },

  // Critical paths that must work in preview
  criticalPaths: [
    '/auth/sign-in',
    '/dashboard',
    '/offers',
    '/adscenter',
    '/tasks',
    '/settings/subscription',
    '/settings/tokens',
    '/settings/referral',
    '/settings/checkin',
    '/manage'
  ],

  // API endpoints for testing
  apiEndpoints: [
    '/health',
    '/api/v1/billing/subscriptions',
    '/api/v1/billing/tokens',
    '/api/v1/billing/permissions/check',
    '/api/v1/offers',
    '/api/v1/evaluations',
    '/api/v1/check-in',
    '/api/v1/referral',
    '/api/v1/user/notifications'
  ]
};

/**
 * Browser configuration for preview testing
 */
function getBrowserConfig(headless = true) {
  return {
    headless: headless,
    slowMo: process.env.SLOWMO ? 100 : 0,
    args: [
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--ignore-certificate-errors',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ],
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };
}

/**
 * Authentication setup for preview testing
 */
async function setupAuthentication(page, accountType = 'regular') {
  const account = PREVIEW_CONFIG.testAccounts[accountType];

  console.log(`🔐 Setting up authentication for ${accountType} account...`);

  try {
    // Navigate to sign-in page
    await page.goto(`${PREVIEW_CONFIG.baseUrl}/auth/sign-in`, {
      waitUntil: 'networkidle',
      timeout: PREVIEW_CONFIG.timeouts.default
    });

    // Wait for sign-in form
    await page.waitForSelector('form', { timeout: 10000 });

    // Fill in credentials
    await page.fill('input[type="email"], input[name="email"]', account.email);
    await page.fill('input[type="password"], input[name="password"]', account.password);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for successful authentication (redirect to dashboard)
    await page.waitForURL('**/dashboard', {
      timeout: PREVIEW_CONFIG.timeouts.critical
    });

    console.log(`✅ Authentication successful for ${accountType} account`);
    return true;

  } catch (error) {
    console.error(`❌ Authentication failed for ${accountType} account:`, error.message);

    // Take screenshot for debugging
    const screenshotPath = `/tmp/auth-failure-${accountType}-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Authentication failure screenshot: ${screenshotPath}`);

    return false;
  }
}

/**
 * Health check for preview environment
 */
async function checkPreviewHealth() {
  console.log(`🏥 Checking preview environment health...`);

  const healthResults = {
    frontend: false,
    api: false,
    services: {},
    timestamp: new Date().toISOString()
  };

  try {
    // Check frontend
    const frontendResponse = await fetch(PREVIEW_CONFIG.baseUrl, {
      method: 'GET',
      timeout: 10000
    });

    healthResults.frontend = frontendResponse.ok;
    console.log(`${healthResults.frontend ? '✅' : '❌'} Frontend health: ${frontendResponse.status}`);

    // Check API Gateway
    const apiResponse = await fetch(`${PREVIEW_CONFIG.apiBaseUrl}/health`, {
      method: 'GET',
      timeout: 10000
    });

    healthResults.api = apiResponse.ok;
    console.log(`${healthResults.api ? '✅' : '❌'} API Gateway health: ${apiResponse.status}`);

    // Check critical services
    const criticalServices = ['billing', 'offer', 'useractivity'];

    for (const service of criticalServices) {
      try {
        const serviceResponse = await fetch(`${PREVIEW_CONFIG.services[service]}/health`, {
          method: 'GET',
          timeout: 5000
        });

        healthResults.services[service] = serviceResponse.ok;
        console.log(`${serviceResponse.ok ? '✅' : '❌'} ${service} service health: ${serviceResponse.status}`);
      } catch (error) {
        healthResults.services[service] = false;
        console.log(`❌ ${service} service health: Error - ${error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Health check failed:', error.message);
  }

  return healthResults;
}

/**
 * Test suite configuration for preview environment
 */
const PREVIEW_TEST_SUITES = {
  // Critical tests that must always pass
  critical: [
    {
      name: 'Frontend Access',
      file: 'test-frontend-access.mjs',
      description: 'Verify frontend loads and basic functionality works',
      timeout: 30000
    },
    {
      name: 'Authentication Flow',
      file: 'test-authentication-flow.mjs',
      description: 'Test complete authentication flow',
      timeout: 60000
    },
    {
      name: 'Dashboard Functionality',
      file: 'test-dashboard-functionality.mjs',
      description: 'Test dashboard loads and displays data',
      timeout: 45000
    },
    {
      name: 'Core API Endpoints',
      file: 'test-api-endpoints.mjs',
      description: 'Test critical API endpoints are working',
      timeout: 30000
    }
  ],

  // Subscription system enhancement tests
  subscription: [
    {
      name: 'Trial Subscription System',
      file: 'test-trial-subscription-system.mjs',
      description: 'Test 7-day and 14-day trial subscription flows',
      timeout: 60000
    },
    {
      name: 'Billing Permission Service',
      file: 'test-billing-permission-service.mjs',
      description: 'Test billing permission checking and caching',
      timeout: 45000
    },
    {
      name: 'Token Cost Service',
      file: 'test-token-cost-service.mjs',
      description: 'Test token cost calculation and configuration',
      timeout: 30000
    },
    {
      name: 'Gateway Middleware Permissions',
      file: 'test-gateway-middleware-permissions.mjs',
      description: 'Test gateway JWT authentication and permissions',
      timeout: 45000
    },
    {
      name: 'Token Reservation Mechanism',
      file: 'test-token-reservation-mechanism.mjs',
      description: 'Test Reserve → Consume/Release token flow',
      timeout: 60000
    },
    {
      name: 'Subscription Config Hot Reload',
      file: 'test-subscription-config-hotreload.mjs',
      description: 'Test real-time configuration updates',
      timeout: 90000
    }
  ],

  // Business functionality tests
  business: [
    {
      name: 'Offer Evaluation Complete',
      file: 'test-offer-evaluation-complete.mjs',
      description: 'Test complete offer evaluation workflow',
      timeout: 180000
    },
    {
      name: 'AI Evaluation Complete',
      file: 'test-ai-evaluation-complete.mjs',
      description: 'Test AI-powered evaluation features',
      timeout: 120000
    },
    {
      name: 'User Permissions Complete',
      file: 'test-user-permissions-complete.mjs',
      description: 'Test user permissions and role-based access',
      timeout: 120000
    },
    {
      name: 'Settings Complete',
      file: 'test-settings-complete.mjs',
      description: 'Test all settings page functionality',
      timeout: 120000
    },
    {
      name: 'Manage Complete',
      file: 'test-manage-complete.mjs',
      description: 'Test admin management functionality',
      timeout: 150000
    }
  ],

  // Performance and reliability tests
  performance: [
    {
      name: 'Performance Baseline',
      file: 'test-performance-baseline.mjs',
      description: 'Establish performance baselines',
      timeout: 120000
    },
    {
      name: 'Load Testing',
      file: 'test-load-testing.mjs',
      description: 'Test system under load',
      timeout: 300000
    }
  ]
};

/**
 * Run preview environment test suite
 */
async function runPreviewTestSuite(suiteType = 'critical') {
  console.log(`🧪 Running ${suiteType} test suite on preview environment...`);
  console.log(`Environment: ${PREVIEW_CONFIG.baseUrl}`);

  const startTime = Date.now();
  const results = [];

  // Check environment health first
  const healthCheck = await checkPreviewHealth();
  if (!healthCheck.frontend && !healthCheck.api) {
    console.error('❌ Preview environment health check failed. Aborting tests.');
    return { success: false, reason: 'Health check failed', results: [] };
  }

  const testSuites = PREVIEW_TEST_SUITES[suiteType] || [];

  for (const testSuite of testSuites) {
    console.log(`\n🔍 Running: ${testSuite.name}`);
    console.log(`📝 Description: ${testSuite.description}`);

    try {
      // Dynamic import and run test
      const testModule = await import(`../tests/${testSuite.file}`);
      const result = await testModule.default();

      results.push({
        suite: testSuite.name,
        file: testSuite.file,
        success: true,
        duration: Date.now() - startTime,
        details: result
      });

      console.log(`✅ ${testSuite.name} completed successfully`);

    } catch (error) {
      console.error(`❌ ${testSuite.name} failed: ${error.message}`);

      results.push({
        suite: testSuite.name,
        file: testSuite.file,
        success: false,
        duration: Date.now() - startTime,
        error: error.message
      });
    }

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  const totalDuration = Date.now() - startTime;
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;

  return {
    success: successCount === totalCount,
    environment: PREVIEW_CONFIG.environment,
    baseUrl: PREVIEW_CONFIG.baseUrl,
    healthCheck,
    results,
    summary: {
      total: totalCount,
      passed: successCount,
      failed: totalCount - successCount,
      successRate: ((successCount / totalCount) * 100).toFixed(1) + '%',
      duration: totalDuration
    }
  };
}

export {
  PREVIEW_CONFIG,
  PREVIEW_TEST_SUITES,
  getBrowserConfig,
  setupAuthentication,
  checkPreviewHealth,
  runPreviewTestSuite
};