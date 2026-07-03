#!/usr/bin/env node

/**
 * Frontend Functionality Testing
 * 测试前端功能，不依赖Demo Data API
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';

class FrontendFunctionalityTester {
  constructor() {
    this.baseUrl = 'https://www.urlchecker.dev';
    this.browser = null;
    this.context = null;
    this.results = {
      startTime: new Date(),
      tests: [],
      errors: [],
      screenshots: []
    };
  }

  async setup() {
    console.log('🚀 Setting up Frontend Functionality testing...');

    this.browser = await chromium.launch({
      headless: false, // Use headed mode for debugging
      slowMo: 500, // Slow down for better visibility
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Frontend-Functionality-Tester/1.0'
    });

    console.log('✅ Browser setup completed');
  }

  async runTest(testName, testFunction) {
    const page = await this.context.newPage();

    try {
      console.log(`🧪 Running test: ${testName}`);

      // Add error handling
      page.on('pageerror', (error) => {
        console.error(`Page error in ${testName}:`, error.message);
        this.results.errors.push({
          test: testName,
          type: 'pageerror',
          error: error.message
        });
      });

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

      // Take screenshot on failure
      const screenshotPath = `/tmp/frontend-test-failure-${testName.replace(/\s+/g, '-')}-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      this.results.screenshots.push(screenshotPath);
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

  // Test Homepage Loading
  async testHomepageLoading(page) {
    console.log(`🏠 Testing homepage loading...`);

    const startTime = Date.now();

    const response = await page.goto(this.baseUrl, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    const loadTime = Date.now() - startTime;

    if (!response.ok()) {
      throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
    }

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Check for common elements
    const title = await page.title();
    const hasNavigation = await page.locator('nav, [role="navigation"], header').isVisible({ timeout: 5000 }).catch(() => false);
    const hasMainContent = await page.locator('main, #root, .container').isVisible({ timeout: 5000 }).catch(() => false);

    return {
      status: response.status(),
      statusText: response.statusText(),
      loadTime,
      title,
      url: page.url(),
      hasNavigation,
      hasMainContent
    };
  }

  // Test Navigation to Sign In
  async testNavigationToSignIn(page) {
    console.log(`🔐 Testing navigation to sign-in...`);

    const startTime = Date.now();

    // Look for sign-in link or button
    const signInSelectors = [
      'a[href*="sign-in"]',
      'a[href*="signin"]',
      'a[href*="auth"]',
      'button:has-text("Sign")',
      'button:has-text("Login")',
      '[data-testid="sign-in-button"]'
    ];

    let signInElement = null;
    for (const selector of signInSelectors) {
      try {
        signInElement = await page.locator(selector).first({ timeout: 2000 });
        if (await signInElement.isVisible()) {
          break;
        }
      } catch (e) {
        // Continue trying other selectors
      }
    }

    if (signInElement && await signInElement.isVisible()) {
      await signInElement.click();

      // Wait for navigation
      await page.waitForLoadState('networkidle', { timeout: 10000 });

      const navigationTime = Date.now() - startTime;
      const finalUrl = page.url();

      return {
        foundSignInElement: true,
        navigationTime,
        finalUrl,
        isAuthPage: finalUrl.includes('auth') || finalUrl.includes('sign-in')
      };
    } else {
      // Try direct navigation
      const response = await page.goto(`${this.baseUrl}/auth/sign-in`, {
        waitUntil: 'networkidle',
        timeout: 10000
      });

      const navigationTime = Date.now() - startTime;

      if (response.ok()) {
        return {
          foundSignInElement: false,
          usedDirectNavigation: true,
          navigationTime,
          finalUrl: page.url(),
          status: response.status()
        };
      } else {
        throw new Error(`Direct navigation failed: HTTP ${response.status()}`);
      }
    }
  }

  // Test Authentication Form
  async testAuthenticationForm(page) {
    console.log(`🔑 Testing authentication form...`);

    const startTime = Date.now();

    // Navigate to sign-in page if not already there
    if (!page.url().includes('auth') && !page.url().includes('sign-in')) {
      await page.goto(`${this.baseUrl}/auth/sign-in`, {
        waitUntil: 'networkidle',
        timeout: 10000
      });
    }

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Look for form elements
    const hasForm = await page.locator('form').isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmailInput = await page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').isVisible({ timeout: 3000 }).catch(() => false);
    const hasPasswordInput = await page.locator('input[type="password"], input[name="password"], input[placeholder*="password" i]').isVisible({ timeout: 3000 }).catch(() => false);
    const hasSubmitButton = await page.locator('button[type="submit"], button:has-text("Sign"), button:has-text("Login"), button:has-text("Submit")').isVisible({ timeout: 3000 }).catch(() => false);

    return {
      loadTime,
      currentUrl: page.url(),
      hasForm,
      hasEmailInput,
      hasPasswordInput,
      hasSubmitButton,
      formComplete: hasForm && hasEmailInput && hasPasswordInput && hasSubmitButton
    };
  }

  // Test Dashboard Access (without authentication)
  async testDashboardAccess(page) {
    console.log(`📊 Testing dashboard access...`);

    const startTime = Date.now();

    const response = await page.goto(`${this.baseUrl}/dashboard`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    const loadTime = Date.now() - startTime;
    const finalUrl = page.url();

    // Check if we're redirected to auth or can see dashboard
    const isAuthPage = finalUrl.includes('auth') || finalUrl.includes('sign-in');
    const isDashboardPage = finalUrl.includes('dashboard');

    // Try to find dashboard elements
    const hasDashboardContent = await page.locator('[data-testid*="dashboard"], .dashboard, main').isVisible({ timeout: 5000 }).catch(() => false);
    const hasStatsCards = await page.locator('[data-testid*="stats"], .stat-card, .metric').isVisible({ timeout: 3000 }).catch(() => false);

    return {
      status: response.status(),
      loadTime,
      finalUrl,
      isAuthPage,
      isDashboardPage,
      hasDashboardContent,
      hasStatsCards,
      authRequired: isAuthPage
    };
  }

  // Test Offers Page Access
  async testOffersPageAccess(page) {
    console.log(`💼 Testing offers page access...`);

    const startTime = Date.now();

    const response = await page.goto(`${this.baseUrl}/offers`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    const loadTime = Date.now() - startTime;
    const finalUrl = page.url();

    // Check if we're redirected to auth or can see offers
    const isAuthPage = finalUrl.includes('auth') || finalUrl.includes('sign-in');
    const isOffersPage = finalUrl.includes('offers');

    // Try to find offers-related elements
    const hasOffersContent = await page.locator('[data-testid*="offers"], .offers, main').isVisible({ timeout: 5000 }).catch(() => false);
    const hasOfferCards = await page.locator('[data-testid*="offer"], .offer-card, .offer-item').isVisible({ timeout: 3000 }).catch(() => false);
    const hasAddOfferButton = await page.locator('[data-testid*="add"], button:has-text("Add"), button:has-text("New")').isVisible({ timeout: 3000 }).catch(() => false);

    return {
      status: response.status(),
      loadTime,
      finalUrl,
      isAuthPage,
      isOffersPage,
      hasOffersContent,
      hasOfferCards,
      hasAddOfferButton,
      authRequired: isAuthPage
    };
  }

  // Test Settings Page Access
  async testSettingsPageAccess(page) {
    console.log(`⚙️ Testing settings page access...`);

    const startTime = Date.now();

    const response = await page.goto(`${this.baseUrl}/settings`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    const loadTime = Date.now() - startTime;
    const finalUrl = page.url();

    // Check if we're redirected to auth or can see settings
    const isAuthPage = finalUrl.includes('auth') || finalUrl.includes('sign-in');
    const isSettingsPage = finalUrl.includes('settings');

    // Try to find settings-related elements
    const hasSettingsContent = await page.locator('[data-testid*="settings"], .settings, main').isVisible({ timeout: 5000 }).catch(() => false);
    const hasSettingsMenu = await page.locator('[data-testid*="menu"], .settings-menu, nav').isVisible({ timeout: 3000 }).catch(() => false);

    return {
      status: response.status(),
      loadTime,
      finalUrl,
      isAuthPage,
      isSettingsPage,
      hasSettingsContent,
      hasSettingsMenu,
      authRequired: isAuthPage
    };
  }

  // Test Responsive Design
  async testResponsiveDesign(page) {
    console.log(`📱 Testing responsive design...`);

    const results = [];

    // Test different viewport sizes
    const viewports = [
      { name: 'Desktop', width: 1280, height: 720 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Mobile', width: 375, height: 667 }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(1000); // Wait for layout adjustment

      const hasHorizontalScrollbar = await page.evaluate(() => {
        return document.body.scrollWidth > document.body.clientWidth;
      });

      results.push({
        viewport: viewport.name,
        width: viewport.width,
        height: viewport.height,
        hasHorizontalScrollbar,
        responsive: !hasHorizontalScrollbar
      });
    }

    return {
      viewports: results,
      allResponsive: results.every(r => r.responsive)
    };
  }

  async cleanup() {
    console.log('🧹 Cleaning up Frontend Functionality testing...');

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
        baseUrl: this.baseUrl
      },
      summary: {
        totalTests,
        successfulTests,
        failedTests: totalTests - successfulTests,
        successRate: totalTests > 0 ? ((successfulTests / totalTests) * 100).toFixed(1) + '%' : '0%'
      },
      tests: this.results.tests,
      errors: this.results.errors,
      screenshots: this.results.screenshots,
      recommendations: this.generateRecommendations()
    };
  }

  generateRecommendations() {
    const recommendations = [];
    const failedTests = this.results.tests.filter(t => !t.success);

    if (failedTests.length > 0) {
      recommendations.push(`🔧 Fix ${failedTests.length} failed frontend tests`);
    }

    // Check for common issues
    const authTest = this.results.tests.find(t => t.name === 'Authentication Form');
    if (authTest && authTest.success && !authTest.details.formComplete) {
      recommendations.push('📝 Authentication form is incomplete - missing input fields or buttons');
    }

    const dashboardTest = this.results.tests.find(t => t.name === 'Dashboard Access');
    if (dashboardTest && dashboardTest.success && dashboardTest.details.authRequired) {
      recommendations.push('🔐 Dashboard requires authentication - this is expected behavior');
    }

    const responsiveTest = this.results.tests.find(t => t.name === 'Responsive Design');
    if (responsiveTest && responsiveTest.success && !responsiveTest.details.allResponsive) {
      recommendations.push('📱 Some viewport sizes have horizontal scrolling - improve responsive design');
    }

    const successfulTests = this.results.tests.filter(t => t.success).length;
    const totalTests = this.results.tests.length;
    if (successfulTests === totalTests && totalTests > 0) {
      recommendations.push('✅ All frontend functionality tests passed - frontend is working correctly');
      recommendations.push('🚀 Ready for implementing and testing Demo Data API');
    }

    return recommendations;
  }
}

// Main execution
async function main() {
  console.log('🎯 Frontend Functionality Testing');
  console.log('=================================');
  console.log(`Frontend: https://www.urlchecker.dev`);
  console.log('Note: Testing frontend functionality without Demo Data API');
  console.log('---');

  const tester = new FrontendFunctionalityTester();

  try {
    await tester.setup();

    // Run frontend functionality tests
    const tests = [
      { name: 'Homepage Loading', fn: tester.testHomepageLoading.bind(tester) },
      { name: 'Navigation to Sign In', fn: tester.testNavigationToSignIn.bind(tester) },
      { name: 'Authentication Form', fn: tester.testAuthenticationForm.bind(tester) },
      { name: 'Dashboard Access', fn: tester.testDashboardAccess.bind(tester) },
      { name: 'Offers Page Access', fn: tester.testOffersPageAccess.bind(tester) },
      { name: 'Settings Page Access', fn: tester.testSettingsPageAccess.bind(tester) },
      { name: 'Responsive Design', fn: tester.testResponsiveDesign.bind(tester) }
    ];

    for (const test of tests) {
      await tester.runTest(test.name, test.fn);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Generate and display report
    const report = tester.generateReport();

    console.log('\n📊 Frontend Functionality Test Results:');
    console.log('========================================');
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
        if (test.details.authRequired !== undefined) {
          console.log(`  Auth Required: ${test.details.authRequired}`);
        }
      } else {
        console.log(`\n❌ ${test.name}: ${test.error}`);
        if (test.screenshot) {
          console.log(`  📸 Screenshot: ${test.screenshot}`);
        }
      }
    }

    // Show screenshots
    if (report.screenshots.length > 0) {
      console.log(`\n📸 Screenshots saved: ${report.screenshots.length} files`);
    }

    // Show recommendations
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => {
        console.log(rec);
      });
    }

    // Save detailed report
    const reportPath = '/tmp/frontend-functionality-test-results.json';
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    // Exit with appropriate code
    const successRate = parseFloat(report.summary.successRate);
    if (successRate >= 80) {
      console.log('\n🎉 Frontend functionality is good! Ready for next development phase.');
      process.exit(0);
    } else {
      console.log('\n⚠️ Some frontend functionality issues detected. Address before proceeding.');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Frontend functionality test failed:', error);
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