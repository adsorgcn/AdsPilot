#!/usr/bin/env node

/**
 * Preview Environment E2E Testing
 * Direct testing of www.urlchecker.dev without local setup
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

// Import preview configuration
import {
  PREVIEW_CONFIG,
  getBrowserConfig,
  setupAuthentication,
  checkPreviewHealth
} from '../utils/preview-environment-config.js';

class PreviewEnvironmentTester {
  constructor(options = {}) {
    this.config = { ...PREVIEW_CONFIG, ...options };
    this.browser = null;
    this.context = null;
    this.results = {
      environment: 'preview',
      baseUrl: this.config.baseUrl,
      startTime: null,
      endTime: null,
      tests: [],
      errors: []
    };
  }

  async setup() {
    console.log('🚀 Setting up preview environment testing...');
    this.results.startTime = new Date();

    // Check environment health first
    const healthCheck = await checkPreviewHealth();
    if (!healthCheck.frontend && !healthCheck.api) {
      throw new Error('Preview environment health check failed');
    }

    console.log('✅ Environment health check passed');

    // Setup browser
    const browserConfig = getBrowserConfig(process.env.HEADLESS === 'false' ? false : true);
    this.browser = await chromium.launch(browserConfig);

    this.context = await this.browser.newContext({
      ...browserConfig,
      // Add viewport and user agent for better testing
      extraHTTPHeaders: {
        'User-Agent': 'Preview-Environment-Tester/1.0',
        'X-Test-Environment': 'preview'
      }
    });

    console.log('✅ Browser setup completed');
  }

  async runTest(testName, testFunction) {
    const page = await this.context.newPage();

    try {
      console.log(`🧪 Running test: ${testName}`);

      // Add error handling
      page.on('pageerror', (error) => {
        console.error(`Page error in ${testName}:`, error);
        this.results.errors.push({
          test: testName,
          type: 'pageerror',
          error: error.message
        });
      });

      page.on('requestfailed', (request) => {
        console.error(`Request failed in ${testName}: ${request.url()}`);
        this.results.errors.push({
          test: testName,
          type: 'requestfailed',
          url: request.url(),
          error: request.failure().errorText
        });
      });

      // Record test start time
      const testStartTime = Date.now();

      // Run the test function
      const testResult = await testFunction(page);

      // Record test end time
      const testEndTime = Date.now();
      const testDuration = testEndTime - testStartTime;

      this.results.tests.push({
        name: testName,
        success: true,
        duration: testDuration,
        startTime: testStartTime,
        endTime: testEndTime,
        details: testResult
      });

      console.log(`✅ Test passed: ${testName} (${testDuration}ms)`);
      return { success: true, testName, duration: testDuration };

    } catch (error) {
      const testEndTime = Date.now();
      const testDuration = testEndTime - this.results.startTime;

      console.error(`❌ Test failed: ${testName} - ${error.message}`);

      // Take screenshot on failure
      const screenshotPath = `/tmp/test-failure-${testName.replace(/\s+/g, '-')}-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`📸 Screenshot saved: ${screenshotPath}`);

      this.results.tests.push({
        name: testName,
        success: false,
        duration: testDuration,
        error: error.message,
        screenshot: screenshotPath
      });

      return { success: false, testName, error: error.message, screenshot: screenshotPath };

    } finally {
      await page.close();
    }
  }

  // Test functions for preview environment

  async testFrontendAccess(page) {
    console.log(`🌐 Testing frontend access: ${this.config.baseUrl}`);

    const startTime = Date.now();

    // Navigate to homepage
    await page.goto(this.config.baseUrl, {
      waitUntil: 'networkidle',
      timeout: this.config.timeouts.default
    });

    // Wait for main content
    await page.waitForSelector('body', { timeout: 10000 });

    // Check if page loaded successfully
    const title = await page.title();
    console.log(`Page title: ${title}`);

    // Look for key navigation elements
    const navigation = await page.$('nav') || await page.$('[role="navigation"]');
    if (!navigation) {
      throw new Error('Navigation elements not found');
    }

    // Check for main content
    const mainContent = await page.$('main') || await page.$('#root');
    if (!mainContent) {
      throw new Error('Main content not found');
    }

    // Check if critical pages are accessible
    const criticalPaths = ['/offers', '/adscenter', '/tasks'];
    for (const path of criticalPaths) {
      try {
        await page.goto(`${this.config.baseUrl}${path}`, {
          waitUntil: 'networkidle',
          timeout: 10000
        });
        console.log(`✅ Critical path accessible: ${path}`);
      } catch (error) {
        console.log(`⚠️ Critical path issue: ${path} - ${error.message}`);
        this.results.errors.push({
          test: 'FrontendAccess',
          type: 'path_access',
          path,
          error: error.message
        });
      }
    }

    const loadTime = Date.now() - startTime;
    return { loadTime, title, navigationFound: !!navigation, criticalPaths };
  }

  async testAuthenticationFlow(page) {
    console.log(`🔐 Testing authentication flow...`);

    const startTime = Date.now();

    // Navigate to sign-in page
    await page.goto(`${this.config.baseUrl}/auth/sign-in`, {
      waitUntil: 'networkidle',
      timeout: this.config.timeouts.default
    });

    // Check if we're already logged in
    const currentUrl = page.url();
    if (currentUrl.includes('/dashboard')) {
      console.log('✅ Already authenticated (redirected to dashboard)');
      return { alreadyAuthenticated: true, authTime: 0 };
    }

    // Wait for sign-in form
    await page.waitForSelector('form', { timeout: 10000 });

    // Fill in test credentials
    const account = this.config.testAccounts.regular;
    await page.fill('input[type="email"], input[name="email"]', account.email);
    await page.fill('input[type="password"], input[name="password"]', account.password);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard', {
      timeout: this.config.timeouts.critical
    });

    const authTime = Date.now() - startTime;
    return { authTime, loginSuccess: true, account: account.email };
  }

  async testDashboardFunctionality(page) {
    console.log(`📊 Testing dashboard functionality...`);

    const startTime = Date.now();

    // Navigate to dashboard
    await page.goto(`${this.config.baseUrl}/dashboard`, {
      waitUntil: 'networkidle',
      timeout: this.config.timeouts.default
    });

    // Wait for dashboard content to load
    await page.waitForSelector('[data-testid="dashboard-stats"], .dashboard-stats, main', {
      timeout: 15000
    });

    // Check for dashboard elements
    const statsElements = await page.$$('[data-testid="stat-card"], .stat-card, .metric');
    if (statsElements.length === 0) {
      console.log('⚠️ No dashboard stats elements found');
    }

    // Check for user info display
    const userInfo = await page.$('[data-testid="user-info"], .user-info');
    if (userInfo) {
      const userText = await userInfo.textContent();
      console.log(`✅ User info found: ${userText.substring(0, 50)}...`);
    }

    // Check for navigation
    const navigationLinks = await page.$$('a[href], nav a');
    console.log(`✅ Found ${navigationLinks.length} navigation links`);

    // Check for any data loading indicators
    const loadingIndicators = await page.$$('[data-testid="loading"], .loading, .spinner');
    if (loadingIndicators.length > 0) {
      console.log(`ℹ️  Found ${loadingIndicators.length} loading indicators`);
    }

    const loadTime = Date() - startTime;
    return {
      loadTime,
      statsCount: statsElements.length,
      navigationLinks: navigationLinks.length,
      loadingIndicators: loadingIndicators.length
    };
  }

  async testCoreAPIEndpoints(page) {
    console.log(`🔗 Testing core API endpoints...`);

    const apiEndpoints = [
      '/health',
      '/api/v1/billing/subscriptions',
      '/api/v1/billing/tokens',
      '/api/v1/offers',
      '/api/v1/user/notifications'
    ];

    const results = [];

    for (const endpoint of apiEndpoints) {
      const url = `${this.config.apiBaseUrl}${endpoint}`;
      console.log(`Testing endpoint: ${url}`);

      try {
        const startTime = Date.now();
        const response = await page.evaluate(async ({ url, timeout }) => {
          const resp = await fetch(url, {
            method: 'GET',
            timeout: timeout,
            headers: {
              'Content-Type': 'application/json'
            }
          });
          return {
            status: resp.status,
            ok: resp.ok,
            statusText: resp.statusText,
            headers: Object.fromEntries(resp.headers.entries()),
            responseTime: Date.now() - startTime
          };
        }, { url, timeout: 10000 });

        results.push({
          endpoint,
          success: response.ok,
          status: response.status,
          responseTime: response.responseTime
        });

        console.log(`${response.ok ? '✅' : '❌'} ${endpoint} - Status: ${response.status}, Time: ${response.responseTime}ms`);

      } catch (error) {
        console.log(`❌ ${endpoint} - Error: ${error.message}`);
        results.push({
          endpoint,
          success: false,
          error: error.message
        });
      }
    }

    const successfulEndpoints = results.filter(r => r.success).length;
    return {
      tested: results.length,
      successful: successfulEndpoints,
      successRate: ((successfulEndpoints / results.length) * 100).toFixed(1) + '%',
      results
    };
  }

  async testSubscriptionFeatures(page) {
    console.log(`💳 Testing subscription features...`);

    const startTime = Date.now();

    // Navigate to subscription page
    await page.goto(`${this.config.baseUrl}/settings/subscription`, {
      waitUntil: 'networkidle',
      timeout: this.config.timeouts.subscription
    });

    // Wait for subscription page content
    await page.waitForSelector('[data-testid="subscription-info"], .subscription-info, main', {
      timeout: 15000
    });

    // Check for subscription information
    const subscriptionInfo = await page.$('[data-testid="subscription-info"], .subscription-info');
    if (subscriptionInfo) {
      const subText = await subscriptionInfo.textContent();
      console.log(`✅ Subscription info found: ${subText.substring(0, 50)}...`);
    }

    // Look for subscription action buttons
    const actionButtons = await page.$$('[data-testid*="trial"], [data-testid*="upgrade"], .trial-button, .upgrade-button');
    console.log(`✅ Found ${actionButtons.length} subscription action buttons`);

    // Check for pricing information
    const pricingElements = await page.$$('[data-testid="pricing"], .pricing, .price');
    if (pricingElements.length > 0) {
      console.log(`✅ Found ${pricingElements.length} pricing elements`);
    }

    // Check for token balance display
    const tokenBalance = await page.$('[data-testid="token-balance"], .token-balance');
    if (tokenBalance) {
      const tokenText = await tokenBalance.textContent();
      console.log(`✅ Token balance found: ${tokenText}`);
    }

    const loadTime = Date.now() - startTime;
    return {
      loadTime,
      subscriptionInfoFound: !!subscriptionInfo,
      actionButtonsFound: actionButtons.length,
      pricingElementsFound: pricingElements.length,
      tokenBalanceFound: !!tokenBalance
    };
  }

  async cleanup() {
    console.log('🧹 Cleaning up preview environment testing...');
    this.results.endTime = new Date();

    if (this.context) {
      await this.context.close();
    }

    if (this.browser) {
      await this.browser.close();
    }

    console.log('✅ Cleanup completed');
  }

  generateReport() {
    const duration = this.results.endTime - this.results.startTime;
    const successfulTests = this.results.tests.filter(t => t.success).length;
    const totalTests = this.results.tests.length;
    const avgResponseTime = this.results.tests.length > 0
      ? this.results.tests.reduce((sum, t) => sum + (t.duration || 0), 0) / this.results.tests.length
      : 0;

    return {
      environment: this.config.environment,
      baseUrl: this.config.baseUrl,
      timestamp: new Date().toISOString(),
      duration: duration,
      summary: {
        totalTests,
        successfulTests,
        failedTests: totalTests - successfulTests,
        successRate: totalTests > 0 ? ((successfulTests / totalTests) * 100).toFixed(1) + '%' : '0%',
        avgResponseTime: avgResponseTime.toFixed(2) + 'ms'
      },
      tests: this.results.tests,
      errors: this.results.errors,
      recommendations: this.generateRecommendations()
    };
  }

  generateRecommendations() {
    const recommendations = [];
    const failedTests = this.results.tests.filter(t => !t.success);

    if (failedTests.length > 0) {
      recommendations.push(`🔧 Fix ${failedTests.length} failed tests before production deployment`);
    }

    if (this.results.errors.length > 0) {
      recommendations.push(`⚠️ Address ${this.results.errors.length} errors found during testing`);
    }

    const avgResponseTime = this.results.tests.reduce((sum, t) => sum + (t.duration || 0), 0) / this.results.tests.length;
    if (avgResponseTime > 30000) {
      recommendations.push('⚡ Consider optimizing test performance - average response time exceeds 30 seconds');
    }

    const successfulTests = this.results.tests.filter(t => t.success).length;
    const totalTests = this.results.tests.length;
    if (successfulTests === totalTests && totalTests > 0) {
      recommendations.push('✅ All tests passed - preview environment is ready for deployment');
    }

    return recommendations;
  }
}

// Main execution
async function main() {
  console.log('🌐 Preview Environment E2E Testing');
  console.log(`Environment: ${PREVIEW_CONFIG.baseUrl}`);
  console.log(`API Base URL: ${PREVIEW_CONFIG.apiBaseUrl}`);
  console.log(`Branch: ${PREVIEW_CONFIG.branch}`);
  console.log('---');

  const tester = new PreviewEnvironmentTester();

  try {
    await tester.setup();

    // Run test suite
    const tests = [
      { name: 'Frontend Access', fn: tester.testFrontendAccess.bind(tester) },
      { name: 'Authentication Flow', fn: tester.testAuthenticationFlow.bind(tester) },
      { name: 'Dashboard Functionality', fn: tester.testDashboardFunctionality.bind(tester) },
      { name: 'Core API Endpoints', fn: tester.testCoreAPIEndpoints.bind(tester) },
      { name: 'Subscription Features', fn: tester.testSubscriptionFeatures.bind(tester) }
    ];

    for (const test of tests) {
      await tester.runTest(test.name, test.fn);

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Generate and save report
    const report = tester.generateReport();

    console.log('\n📊 Preview Environment Test Results:');
    console.log('=======================================');
    console.log(`Environment: ${report.environment}`);
    console.log(`Base URL: ${report.baseUrl}`);
    console.log(`Duration: ${(report.duration / 1000).toFixed(2)}s`);
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Passed: ${report.summary.successfulTests} ✅`);
    console.log(`Failed: ${report.summary.failedTests} ❌`);
    console.log(`Success Rate: ${report.summary.successRate}`);
    console.log(`Avg Response Time: ${report.summary.avgResponseTime}`);

    // Show failed tests
    const failedTests = tester.results.tests.filter(t => !t.success);
    if (failedTests.length > 0) {
      console.log('\n❌ Failed Tests:');
      failedTests.forEach(test => {
        console.log(`- ${test.name}: ${test.error}`);
        if (test.screenshot) {
          console.log(`  📸 Screenshot: ${test.screenshot}`);
        }
      });
    }

    // Show recommendations
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => {
        console.log(rec);
      });
    }

    // Save detailed report
    const reportPath = '/tmp/preview-test-results.json';
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    // Exit with appropriate code
    const successRate = parseFloat(report.summary.successRate);
    if (successRate >= 95) {
      console.log('\n🎉 Preview environment test passed! Ready for production deployment consideration.');
      process.exit(0);
    } else {
      console.log('\n⚠️  Preview environment test has issues. Please address failures before production deployment.');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Preview environment test failed:', error);
    process.exit(1);

  } finally {
    await tester.cleanup();
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Received interrupt signal, cleaning up...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received termination signal, cleaning up...');
  process.exit(0);
});

main().catch(console.error);