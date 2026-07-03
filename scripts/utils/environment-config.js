/**
 * Environment Configuration for Testing
 * Based on MustKnowV7.md deployment flow
 */

// Environment configuration based on Git branches
const ENVIRONMENTS = {
  preview: {
    name: 'Preview Environment',
    baseUrl: 'https://www.urlchecker.dev',
    branch: 'main',
    imageTag: 'preview-latest',
    deploymentTarget: 'asia-northeast1',
    services: {
      frontend: 'frontend-preview',
      offer: 'offer-preview',
      // Add other preview services as needed
    },
    characteristics: {
      allowsDataLoss: true,
      aggressiveUpdates: true,
      autoSchemaRebuild: true,
      testingMode: true
    },
    testTimeouts: {
      default: 30000,
      critical: 60000,
      performance: 120000
    }
  },
  production: {
    name: 'Production Environment',
    baseUrl: 'https://www.autoads.dev',
    branch: 'production',
    imageTag: 'prod-latest',
    deploymentTarget: 'asia-northeast1',
    services: {
      frontend: 'frontend',
      offer: 'offer',
      // Production services
    },
    characteristics: {
      allowsDataLoss: false,
      aggressiveUpdates: false,
      autoSchemaRebuild: false,
      testingMode: false
    },
    testTimeouts: {
      default: 60000,
      critical: 120000,
      performance: 300000
    }
  },
  staging: {
    name: 'Staging Environment',
    baseUrl: 'https://staging.autoads.dev',
    branch: 'staging',
    imageTag: 'staging-latest',
    deploymentTarget: 'asia-northeast1',
    services: {
      frontend: 'frontend-staging',
      offer: 'offer-staging',
    },
    characteristics: {
      allowsDataLoss: false,
      aggressiveUpdates: false,
      autoSchemaRebuild: false,
      testingMode: true
    },
    testTimeouts: {
      default: 45000,
      critical: 90000,
      performance: 180000
    }
  }
};

// Service-specific configurations
const SERVICE_CONFIGS = {
  // Frontend testing configuration
  frontend: {
    criticalPaths: [
      '/auth/sign-in',
      '/dashboard',
      '/offers',
      '/adscenter',
      '/tasks',
      '/settings/subscription'
    ],
    performanceThresholds: {
      fcp: 1800, // First Contentful Paint (ms)
      lcp: 2500, // Largest Contentful Paint (ms)
      fid: 100,  // First Input Delay (ms)
      cls: 0.1   // Cumulative Layout Shift
    },
    userFlows: [
      'authentication',
      'offerEvaluation',
      'subscriptionManagement',
      'tokenManagement'
    ]
  },

  // Backend service testing configuration
  backend: {
    services: [
      'billing',
      'offer',
      'siterank',
      'adscenter',
      'useractivity',
      'console',
      'bff',
      'gateway-middleware'
    ],
    apiThresholds: {
      responseTime: 2000,    // 95th percentile response time (ms)
      errorRate: 0.01,      // 1% error rate
      availability: 0.999    // 99.9% availability
    },
    loadTestProfiles: {
      light: { users: 10, duration: 300 },    // 5 min
      medium: { users: 50, duration: 600 },   // 10 min
      heavy: { users: 100, duration: 1200 }   // 20 min
    }
  },

  // Subscription system enhancement specific
  subscriptionEnhancement: {
    features: [
      'trialSubscriptions',
      'referralTracking',
      'tokenReservation',
      'gatewayPermissions',
      'configHotReload'
    ],
    testSuites: [
      'test-trial-subscription-system.mjs',
      'test-billing-permission-service.mjs',
      'test-token-cost-service.mjs',
      'test-gateway-middleware-permissions.mjs',
      'test-token-reservation-mechanism.mjs',
      'test-subscription-config-hotreload.mjs',
      'test-trial-subscription-migration.mjs'
    ],
    dataValidation: [
      'billing.subscriptions',
      'subscription_permissions',
      'subscription_token_costs',
      'subscription_config_history',
      'referrals',
      'token_reservations'
    ]
  }
};

/**
 * Get current environment based on process variables
 */
function getCurrentEnvironment() {
  const branch = process.env.GIT_BRANCH || 'main';
  const customEnv = process.env.TEST_ENVIRONMENT;

  if (customEnv && ENVIRONMENTS[customEnv]) {
    return ENVIRONMENTS[customEnv];
  }

  // Default environment based on branch
  if (branch === 'production') {
    return ENVIRONMENTS.production;
  } else if (branch === 'main') {
    return ENVIRONMENTS.preview;
  } else {
    return ENVIRONMENTS.preview; // Default for testing
  }
}

/**
 * Get environment-specific test configuration
 */
function getEnvironmentConfig() {
  const env = getCurrentEnvironment();
  return {
    environment: env,
    baseUrl: env.baseUrl,
    timeouts: env.testTimeouts,
    characteristics: env.characteristics,
    services: env.services
  };
}

/**
 * Get service-specific configuration
 */
function getServiceConfig(serviceType) {
  return SERVICE_CONFIGS[serviceType] || {};
}

/**
 * Validate environment readiness for testing
 */
async function validateEnvironment() {
  const config = getEnvironmentConfig();
  const results = {
    environment: config.environment.name,
    baseUrl: config.baseUrl,
    checks: [],
    ready: false
  };

  console.log(`🔍 Validating ${config.environment.name}...`);

  // Check base URL availability
  try {
    const response = await fetch(`${config.baseUrl}/health`, {
      method: 'GET',
      timeout: 10000
    });

    if (response.ok) {
      results.checks.push({
        name: 'Health Check',
        status: 'passed',
        responseTime: response.headers.get('x-response-time') || 'N/A'
      });
    } else {
      results.checks.push({
        name: 'Health Check',
        status: 'failed',
        error: `HTTP ${response.status}`
      });
    }
  } catch (error) {
    results.checks.push({
      name: 'Health Check',
      status: 'failed',
      error: error.message
    });
  }

  // Check authentication endpoints
  try {
    const authResponse = await fetch(`${config.baseUrl}/auth/sign-in`, {
      method: 'GET',
      timeout: 5000
    });

    results.checks.push({
      name: 'Authentication Endpoint',
      status: authResponse.ok ? 'passed' : 'failed',
      status: authResponse.status
    });
  } catch (error) {
    results.checks.push({
      name: 'Authentication Endpoint',
      status: 'failed',
      error: error.message
    });
  }

  // Check API gateway (if configured)
  if (config.services.gateway) {
    try {
      const apiResponse = await fetch(`http://api.${config.baseUrl.replace('https://www.', '')}/health`, {
        method: 'GET',
        timeout: 5000
      });

      results.checks.push({
        name: 'API Gateway',
        status: apiResponse.ok ? 'passed' : 'failed',
        status: apiResponse.status
      });
    } catch (error) {
      results.checks.push({
        name: 'API Gateway',
        status: 'failed',
        error: error.message
      });
    }
  }

  // Determine readiness
  const passedChecks = results.checks.filter(c => c.status === 'passed').length;
  const totalChecks = results.checks.length;
  results.ready = passedChecks === totalChecks;

  console.log(`✅ Environment validation complete: ${passedChecks}/${totalChecks} checks passed`);

  return results;
}

/**
 * Generate environment-specific test report
 */
function generateEnvironmentReport(testResults, environmentConfig) {
  return {
    timestamp: new Date().toISOString(),
    environment: environmentConfig.environment.name,
    baseUrl: environmentConfig.baseUrl,
    branch: environmentConfig.environment.branch,
    imageTag: environmentConfig.environment.imageTag,
    deploymentTarget: environmentConfig.environment.deploymentTarget,
    characteristics: environmentConfig.environment.characteristics,
    testResults: testResults,
    summary: {
      totalTests: testResults.length,
      passedTests: testResults.filter(r => r.success).length,
      failedTests: testResults.filter(r => !r.success).length,
      successRate: ((testResults.filter(r => r.success).length / testResults.length) * 100).toFixed(2) + '%',
      averageResponseTime: testResults.reduce((sum, r) => sum + (r.responseTime || 0), 0) / testResults.length
    },
    recommendations: generateRecommendations(testResults, environmentConfig)
  };
}

function generateRecommendations(testResults, config) {
  const recommendations = [];
  const failedTests = testResults.filter(r => !r.success);

  if (failedTests.length > 0) {
    recommendations.push(`🔧 Fix ${failedTests.length} failed tests before deployment`);
  }

  // Environment-specific recommendations
  if (config.environment.name === 'Production') {
    if (testResults.some(r => r.responseTime > config.timeouts.critical)) {
      recommendations.push('⚠️ Performance issues detected - consider optimization before production deployment');
    }

    if (testResults.some(r => r.error && r.error.includes('timeout'))) {
      recommendations.push('🚨 Timeout errors detected - investigate network or service performance');
    }
  }

  if (config.environment.name === 'Preview') {
    recommendations.push('✅ Preview environment ready - aggressive testing strategies can be used');
  }

  return recommendations;
}

module.exports = {
  ENVIRONMENTS,
  SERVICE_CONFIGS,
  getCurrentEnvironment,
  getEnvironmentConfig,
  getServiceConfig,
  validateEnvironment,
  generateEnvironmentReport
};