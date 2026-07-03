#!/usr/bin/env node

/**
 * Basic Connectivity Testing
 * 测试预发环境的基本连接和可用性
 */

import { chromium } from 'playwright';

class BasicConnectivityTester {
  constructor() {
    this.baseUrl = 'https://www.urlchecker.dev';
    this.apiBaseUrl = 'http://api.urlchecker.dev';
    this.browser = null;
    this.context = null;
    this.results = {
      startTime: new Date(),
      tests: [],
      errors: []
    };
  }

  async setup() {
    console.log('🚀 Setting up Basic Connectivity testing...');

    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    this.context = await this.browser.newContext({
      userAgent: 'Basic-Connectivity-Tester/1.0'
    });

    console.log('✅ Browser setup completed');
  }

  async runTest(testName, testFunction) {
    const page = await this.context.newPage();

    try {
      console.log(`🧪 Running test: ${testName}`);
      const testStartTime = Date.now();
      const testResult = await testFunction(page);
      const testDuration = Date.now() - testStartTime;

      this.results.tests.push({
        name: testName,
        success: true,
        duration: testDuration,
        details: testResult
      });

      console.log(`✅ Test passed: ${testName} (${testDuration}ms)`);
      return { success: true, testName, duration: testDuration };

    } catch (error) {
      const testDuration = Date.now() - Date.now();
      console.error(`❌ Test failed: ${testName} - ${error.message}`);

      this.results.tests.push({
        name: testName,
        success: false,
        duration: testDuration,
        error: error.message
      });

      return { success: false, testName, error: error.message };

    } finally {
      await page.close();
    }
  }

  // Test Frontend Connectivity
  async testFrontendConnectivity(page) {
    console.log(`🌐 Testing frontend connectivity...`);

    const startTime = Date.now();

    const response = await page.goto(this.baseUrl, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    const loadTime = Date.now() - startTime;

    // Check basic page elements
    const title = await page.title();
    const hasContent = await page.locator('body').isVisible();

    if (!response.ok()) {
      throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
    }

    if (!hasContent) {
      throw new Error('Page body not visible');
    }

    return {
      status: response.status(),
      statusText: response.statusText(),
      loadTime,
      title,
      url: page.url()
    };
  }

  // Test API Gateway Connectivity
  async testAPIConnectivity(page) {
    console.log(`🔗 Testing API connectivity...`);

    const startTime = Date.now();

    const response = await page.evaluate(async ({ apiBaseUrl, evalStartTime }) => {
      try {
        const startTime = evalStartTime;
        const resp = await fetch(`${apiBaseUrl}/health`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });

        const responseTime = Date.now() - startTime;

        if (resp.ok) {
          const data = await resp.text();
          return {
            status: resp.status,
            statusText: resp.statusText,
            responseTime,
            data: data.substring(0, 200) // Truncate long responses
          };
        } else {
          return {
            status: resp.status,
            statusText: resp.statusText,
            responseTime,
            error: `HTTP ${resp.status}`
          };
        }
      } catch (error) {
        return {
          error: error.message,
          responseTime: Date.now() - evalStartTime
        };
      }
    }, {
      apiBaseUrl: this.apiBaseUrl,
      evalStartTime: startTime
    });

    if (response.error) {
      throw new Error(`API connectivity failed: ${response.error}`);
    }

    return response;
  }

  // Test Authentication Page
  async testAuthPage(page) {
    console.log(`🔐 Testing authentication page...`);

    const startTime = Date.now();

    const response = await page.goto(`${this.baseUrl}/auth/sign-in`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    const loadTime = Date.now() - startTime;

    if (!response.ok()) {
      throw new Error(`Auth page HTTP ${response.status()}: ${response.statusText()}`);
    }

    // Check for sign-in form elements
    const hasForm = await page.locator('form').isVisible({ timeout: 10000 });
    const hasEmailInput = await page.locator('input[type="email"], input[name="email"]').isVisible();
    const hasPasswordInput = await page.locator('input[type="password"], input[name="password"]').isVisible();
    const hasSubmitButton = await page.locator('button[type="submit"]').isVisible();

    if (!hasForm) {
      throw new Error('Authentication form not found');
    }

    return {
      status: response.status(),
      loadTime,
      hasForm,
      hasEmailInput,
      hasPasswordInput,
      hasSubmitButton,
      url: page.url()
    };
  }

  // Test Dashboard Page (without authentication)
  async testDashboardPage(page) {
    console.log(`📊 Testing dashboard page...`);

    const startTime = Date.now();

    const response = await page.goto(`${this.baseUrl}/dashboard`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    const loadTime = Date.now() - startTime;

    // Check page response (might redirect to auth)
    const finalUrl = page.url();
    const isAuthPage = finalUrl.includes('/auth/sign-in');
    const isDashboardPage = finalUrl.includes('/dashboard');

    return {
      status: response.status(),
      loadTime,
      finalUrl,
      isAuthPage,
      isDashboardPage,
      // Check if we can see any content
      hasMainContent: await page.locator('main').isVisible({ timeout: 5000 }).catch(() => false)
    };
  }

  async cleanup() {
    console.log('🧹 Cleaning up Basic Connectivity testing...');

    if (this.context) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }

    console.log('✅ Cleanup completed');
  }

  generateReport() {
    const endTime = new Date();
    const duration = endTime - this.results.startTime;
    const successfulTests = this.results.tests.filter(t => t.success).length;
    const totalTests = this.results.tests.length;

    return {
      timestamp: endTime.toISOString(),
      duration: duration,
      environment: {
        baseUrl: this.baseUrl,
        apiBaseUrl: this.apiBaseUrl
      },
      summary: {
        totalTests,
        successfulTests,
        failedTests: totalTests - successfulTests,
        successRate: totalTests > 0 ? ((successfulTests / totalTests) * 100).toFixed(1) + '%' : '0%'
      },
      tests: this.results.tests,
      errors: this.results.errors
    };
  }
}

// Main execution
async function main() {
  console.log('🌐 Basic Connectivity Testing');
  console.log('=================================');
  console.log(`Frontend: https://www.urlchecker.dev`);
  console.log(`API: http://api.urlchecker.dev`);
  console.log('---');

  const tester = new BasicConnectivityTester();

  try {
    await tester.setup();

    // Run basic connectivity tests
    const tests = [
      { name: 'Frontend Connectivity', fn: tester.testFrontendConnectivity.bind(tester) },
      { name: 'API Connectivity', fn: tester.testAPIConnectivity.bind(tester) },
      { name: 'Authentication Page', fn: tester.testAuthPage.bind(tester) },
      { name: 'Dashboard Page', fn: tester.testDashboardPage.bind(tester) }
    ];

    for (const test of tests) {
      await tester.runTest(test.name, test.fn);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Generate and display report
    const report = tester.generateReport();

    console.log('\n📊 Basic Connectivity Test Results:');
    console.log('====================================');
    console.log(`Duration: ${(report.duration / 1000).toFixed(2)}s`);
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Passed: ${report.summary.successfulTests} ✅`);
    console.log(`Failed: ${report.summary.failedTests} ❌`);
    console.log(`Success Rate: ${report.summary.successRate}`);

    // Show test details
    for (const test of report.tests) {
      if (test.success) {
        console.log(`\n✅ ${test.name}:`);
        if (test.details.loadTime) {
          console.log(`  Load Time: ${test.details.loadTime}ms`);
        }
        if (test.details.status) {
          console.log(`  HTTP Status: ${test.details.status}`);
        }
      } else {
        console.log(`\n❌ ${test.name}: ${test.error}`);
      }
    }

    // Show recommendations
    if (report.summary.successRate === '100.0%') {
      console.log('\n🎉 All basic connectivity tests passed! Environment is accessible.');
    } else {
      console.log('\n⚠️ Some connectivity tests failed. Check infrastructure.');
    }

    // Exit with appropriate code
    const successRate = parseFloat(report.summary.successRate);
    if (successRate >= 75) {
      console.log('\n✅ Basic connectivity is sufficient for testing.');
      process.exit(0);
    } else {
      console.log('\n❌ Basic connectivity issues detected. Fix before proceeding.');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Basic connectivity test failed:', error);
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