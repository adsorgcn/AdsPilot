#!/usr/bin/env node

/**
 * Load Testing for Subscription System Enhancement
 * Tests system performance under high load scenarios
 */

import { chromium } from 'playwright';
import { performance } from 'perf_hooks';

const PREVIEW_BASE = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';
const CONCURRENT_USERS = parseInt(process.env.CONCURRENT_USERS) || 10;
const TEST_DURATION = parseInt(process.env.TEST_DURATION) || 60; // seconds

class LoadTester {
  constructor() {
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      errors: [],
      startTime: null,
      endTime: null
    };
  }

  async runConcurrentUser(userId) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
      // Set unique user agent for debugging
      await page.setUserAgent(`LoadTestUser-${userId}`);

      // Simulate login
      console.log(`👤 User ${userId}: Starting load test...`);

      // Test 1: Login Flow
      const loginStart = performance.now();
      await page.goto(`${PREVIEW_BASE}/auth/sign-in`);
      await page.waitForSelector('form', { timeout: 10000 });

      // Fill login form (test credentials)
      await page.fill('input[name="email"]', `loadtest${userId}@test.com`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');

      // Wait for login completion
      await page.waitForURL('**/dashboard', { timeout: 15000 });
      const loginTime = performance.now() - loginStart;
      this.results.responseTimes.push({ type: 'login', time: loginTime, user: userId });

      // Test 2: Dashboard Load
      const dashboardStart = performance.now();
      await page.goto(`${PREVIEW_BASE}/dashboard`);
      await page.waitForSelector('[data-testid="dashboard-stats"]', { timeout: 10000 });
      const dashboardTime = performance.now() - dashboardStart;
      this.results.responseTimes.push({ type: 'dashboard', time: dashboardTime, user: userId });

      // Test 3: Subscription Check
      const subscriptionStart = performance.now();
      await page.goto(`${PREVIEW_BASE}/settings/subscription`);
      await page.waitForSelector('[data-testid="subscription-info"]', { timeout: 10000 });
      const subscriptionTime = performance.now() - subscriptionStart;
      this.results.responseTimes.push({ type: 'subscription', time: subscriptionTime, user: userId });

      // Test 4: Token Management
      const tokenStart = performance.now();
      await page.goto(`${PREVIEW_BASE}/settings/tokens`);
      await page.waitForSelector('[data-testid="token-balance"]', { timeout: 10000 });
      const tokenTime = performance.now() - tokenStart;
      this.results.responseTimes.push({ type: 'tokens', time: tokenTime, user: userId });

      // Test 5: Trial Subscription Creation (if applicable)
      if (Math.random() < 0.3) { // 30% chance to test trial creation
        const trialStart = performance.now();
        try {
          await page.click('[data-testid="start-trial-button"]');
          await page.waitForSelector('[data-testid="trial-confirmation"]', { timeout: 10000 });
          const trialTime = performance.now() - trialStart;
          this.results.responseTimes.push({ type: 'trial_creation', time: trialTime, user: userId });
        } catch (error) {
          this.results.errors.push({
            type: 'trial_creation',
            error: error.message,
            user: userId
          });
        }
      }

      this.results.successfulRequests++;
      console.log(`✅ User ${userId}: Completed successfully`);

    } catch (error) {
      this.results.failedRequests++;
      this.results.errors.push({
        type: 'user_flow',
        error: error.message,
        user: userId
      });
      console.error(`❌ User ${userId}: Failed - ${error.message}`);
    } finally {
      await browser.close();
      this.results.totalRequests++;
    }
  }

  async runLoadTest() {
    console.log(`🚀 Starting Load Test: ${CONCURRENT_USERS} concurrent users for ${TEST_DURATION}s`);
    this.results.startTime = new Date();

    // Create concurrent users
    const userPromises = [];

    for (let i = 1; i <= CONCURRENT_USERS; i++) {
      userPromises.push(this.runConcurrentUser(i));

      // Stagger user starts to simulate real traffic
      await new Promise(resolve => setTimeout(resolve, Math.random() * 2000));
    }

    // Wait for all users to complete
    await Promise.allSettled(userPromises);

    this.results.endTime = new Date();
  }

  generateReport() {
    const duration = this.results.endTime - this.results.startTime;
    const avgResponseTime = this.results.responseTimes.length > 0
      ? this.results.responseTimes.reduce((sum, r) => sum + r.time, 0) / this.results.responseTimes.length
      : 0;

    const responseTimesByType = {};
    this.results.responseTimes.forEach(rt => {
      if (!responseTimesByType[rt.type]) {
        responseTimesByType[rt.type] = [];
      }
      responseTimesByType[rt.type].push(rt.time);
    });

    const stats = {};
    Object.keys(responseTimesByType).forEach(type => {
      const times = responseTimesByType[type];
      stats[type] = {
        count: times.length,
        avg: times.reduce((a, b) => a + b, 0) / times.length,
        min: Math.min(...times),
        max: Math.max(...times),
        p95: times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)]
      };
    });

    return {
      summary: {
        totalUsers: CONCURRENT_USERS,
        totalRequests: this.results.totalRequests,
        successfulRequests: this.results.successfulRequests,
        failedRequests: this.results.failedRequests,
        successRate: ((this.results.successfulRequests / this.results.totalRequests) * 100).toFixed(2) + '%',
        testDuration: duration + 'ms',
        avgResponseTime: avgResponseTime.toFixed(2) + 'ms'
      },
      performance: stats,
      errors: this.results.errors,
      recommendations: this.generateRecommendations(stats, this.results.errors)
    };
  }

  generateRecommendations(stats, errors) {
    const recommendations = [];

    // Check response times
    Object.keys(stats).forEach(type => {
      if (stats[type].avg > 3000) {
        recommendations.push(`⚠️ ${type} API average response time (${stats[type].avg.toFixed(0)}ms) exceeds 3s threshold`);
      }
      if (stats[type].p95 > 5000) {
        recommendations.push(`🚨 ${type} API P95 response time (${stats[type].p95.toFixed(0)}ms) exceeds 5s threshold`);
      }
    });

    // Check error rates
    const errorRate = (errors.length / this.results.totalRequests) * 100;
    if (errorRate > 5) {
      recommendations.push(`🚨 High error rate: ${errorRate.toFixed(2)}% (${errors.length}/${this.results.totalRequests})`);
    }

    // Check specific error patterns
    const timeoutErrors = errors.filter(e => e.error.includes('timeout')).length;
    if (timeoutErrors > 0) {
      recommendations.push(`⚠️ ${timeoutErrors} timeout errors detected - consider increasing timeout values`);
    }

    const trialErrors = errors.filter(e => e.type === 'trial_creation').length;
    if (trialErrors > 0) {
      recommendations.push(`💡 ${trialErrors} trial creation errors - review trial subscription logic`);
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ All performance metrics within acceptable ranges');
    }

    return recommendations;
  }
}

async function main() {
  console.log('🏋️ Load Testing for Subscription System Enhancement');
  console.log(`Environment: ${PREVIEW_BASE}`);
  console.log(`Concurrent Users: ${CONCURRENT_USERS}`);
  console.log(`Test Duration: ${TEST_DURATION}s`);
  console.log('---');

  const tester = new LoadTester();

  try {
    await tester.runLoadTest();
    const report = tester.generateReport();

    console.log('\n📊 Load Test Results:');
    console.log('==================');
    console.log(JSON.stringify(report, null, 2));

    // Save detailed report
    const reportPath = 'load-test-results.json';
    await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    // Exit with error code if success rate is below 95%
    const successRate = parseFloat(report.summary.successRate);
    if (successRate < 95) {
      console.error(`\n❌ Load test failed: Success rate ${successRate}% < 95%`);
      process.exit(1);
    } else {
      console.log(`\n✅ Load test passed: Success rate ${successRate}% >= 95%`);
    }

  } catch (error) {
    console.error('❌ Load test failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);