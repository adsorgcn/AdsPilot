#!/usr/bin/env node

/**
 * New User Onboarding System E2E Test
 * 测试新用户自动初始化系统 (Trial → Demo Offers + Welcome + Checkin + Referral)
 */

import { chromium } from 'playwright';
import { randomUUID } from 'crypto';

const PREVIEW_BASE_URL = 'https://www.urlchecker.dev';
const API_GATEWAY = 'https://gateway-middleware-preview-yt54xvsg5q-an.a.run.app';

class OnboardingSystemTester {
  constructor() {
    this.browser = null;
    this.context = null;
    this.testUserId = null;
    this.testEmail = `test-onboarding-${Date.now()}@example.com`;
    this.results = {
      trialCreated: false,
      demoOffersCreated: false,
      welcomeNotification: false,
      checkinInitialized: false,
      referralCodeGenerated: false,
      errors: []
    };
  }

  async setup() {
    console.log('🚀 Setting up Onboarding System test...\n');

    this.browser = await chromium.launch({
      headless: process.env.HEADLESS !== 'false',
      slowMo: 100
    });

    this.context = await this.browser.newContext({
      ignoreHTTPSErrors: true
    });

    console.log(`✅ Browser setup completed`);
    console.log(`📧 Test email: ${this.testEmail}\n`);
  }

  async testOnboardingFlow() {
    const page = await this.context.newPage();

    try {
      console.log('📋 Step 1: Register new user and create trial subscription...');
      console.log('   Note: This system uses Google OAuth for authentication');
      console.log('   Please use a new Google account to test the onboarding flow');
      console.log('');

      // Navigate to auth page (Google OAuth)
      await page.goto(`${PREVIEW_BASE_URL}/auth`, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // User needs to manually complete Google OAuth
      // This is a placeholder - actual testing requires manual Google login
      console.log('   ⚠️  Automated OAuth testing not implemented');
      console.log('   Please test manually by:');
      console.log('   1. Visit https://www.urlchecker.dev/auth');
      console.log('   2. Use a new Google account');
      console.log('   3. Complete OAuth flow');

      // Skip automated steps for now
      throw new Error('Manual testing required for OAuth flow');

      // Wait for redirect to dashboard or onboarding
      await page.waitForURL(/\/(dashboard|onboarding)/, {
        timeout: 60000
      });

      console.log('✅ User registration completed');

      // Extract user ID from page or localStorage
      this.testUserId = await page.evaluate(() => {
        // Try to get user ID from various sources
        const userData = localStorage.getItem('user-data');
        if (userData) {
          try {
            const parsed = JSON.parse(userData);
            return parsed.id || parsed.userId || parsed.user_id;
          } catch (e) {
            console.error('Failed to parse user data:', e);
          }
        }

        // Fallback: check window object
        return window.userId || window.currentUser?.id;
      });

      if (!this.testUserId) {
        throw new Error('Could not extract user ID after registration');
      }

      console.log(`   User ID: ${this.testUserId}`);
      this.results.trialCreated = true;

      console.log('\n⏳ Step 2: Waiting 15 seconds for async onboarding to complete...');
      await new Promise(resolve => setTimeout(resolve, 15000));

      console.log('\n🔍 Step 3: Verifying demo offers creation...');

      // Navigate to offers page
      await page.goto(`${PREVIEW_BASE_URL}/offers`, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Wait for offers to load
      await page.waitForSelector('main', { timeout: 10000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Count offers
      const offersCount = await page.evaluate(() => {
        const offerElements = document.querySelectorAll(
          '[data-testid="offer-card"], [data-testid="offer-row"], .offer-card, .offer-row, [role="row"]:has([data-testid*="offer"])'
        );
        return offerElements.length;
      });

      console.log(`   Found ${offersCount} offers`);
      this.results.demoOffersCreated = offersCount === 8;

      if (offersCount === 8) {
        console.log('   ✅ Expected 8 demo offers created');
      } else {
        console.log(`   ⚠️  Expected 8 demo offers, got ${offersCount}`);
      }

      console.log('\n🔔 Step 4: Checking welcome notification...');

      // Navigate to notifications or check notification icon
      const notificationBadge = await page.$('[data-testid="notification-badge"], .notification-badge, [aria-label*="notification"]');

      if (notificationBadge) {
        await notificationBadge.click();
        await new Promise(resolve => setTimeout(resolve, 1000));

        const welcomeNotification = await page.evaluate(() => {
          const notifications = document.querySelectorAll('[data-testid*="notification"], .notification-item');
          return Array.from(notifications).some(n =>
            n.textContent.includes('Welcome') || n.textContent.includes('欢迎')
          );
        });

        this.results.welcomeNotification = welcomeNotification;
        console.log(welcomeNotification ? '   ✅ Welcome notification found' : '   ⚠️  Welcome notification not found');
      } else {
        console.log('   ℹ️  Notification UI not accessible, skipping');
      }

      console.log('\n✅ Step 5: Checking checkin initialization...');

      // Navigate to checkin page
      await page.goto(`${PREVIEW_BASE_URL}/settings/checkin`, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      const checkinState = await page.evaluate(() => {
        const pageText = document.body.textContent;
        // Check for initialized state (0 days streak, able to check in)
        const hasCheckinButton = document.querySelector('button:has-text("Check In"), button:has-text("签到")');
        const hasStats = pageText.includes('连续签到') || pageText.includes('Streak');

        return {
          hasButton: !!hasCheckinButton,
          hasStats
        };
      });

      this.results.checkinInitialized = checkinState.hasButton || checkinState.hasStats;
      console.log(this.results.checkinInitialized ? '   ✅ Checkin system initialized' : '   ⚠️  Checkin system not initialized');

      console.log('\n🎁 Step 6: Checking referral code generation...');

      // Navigate to referral page
      await page.goto(`${PREVIEW_BASE_URL}/settings/referral`, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      const referralCode = await page.evaluate(() => {
        const codeElement = document.querySelector('[data-testid="referral-code"], .referral-code, code, [class*="code"]');
        return codeElement?.textContent?.trim();
      });

      this.results.referralCodeGenerated = !!referralCode && referralCode.length >= 8;
      console.log(referralCode ? `   ✅ Referral code generated: ${referralCode}` : '   ⚠️  Referral code not found');

      console.log('\n🎯 Step 7: Verifying token balance...');

      // Navigate to tokens page
      await page.goto(`${PREVIEW_BASE_URL}/settings/tokens`, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      const tokenBalance = await page.evaluate(() => {
        const balanceElement = document.querySelector('[data-testid="token-balance"], .token-balance, [class*="balance"]');
        const balanceText = balanceElement?.textContent || document.body.textContent;
        const match = balanceText.match(/(\d{1,5})/);
        return match ? parseInt(match[1]) : 0;
      });

      console.log(`   Token balance: ${tokenBalance}`);
      if (tokenBalance === 1000) {
        console.log('   ✅ Trial tokens granted (1000)');
      } else if (tokenBalance > 0) {
        console.log('   ⚠️  Unexpected token balance');
      } else {
        console.log('   ❌ No tokens granted');
      }

    } catch (error) {
      console.error(`\n❌ Test failed: ${error.message}`);
      this.results.errors.push(error.message);

      // Take screenshot on error
      try {
        const screenshotPath = `/tmp/onboarding-test-error-${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`📸 Screenshot saved: ${screenshotPath}`);
      } catch (screenshotError) {
        console.error('Failed to take screenshot:', screenshotError);
      }

      throw error;

    } finally {
      await page.close();
    }
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');

    if (this.context) {
      await this.context.close();
    }

    if (this.browser) {
      await this.browser.close();
    }

    console.log('✅ Cleanup completed');
  }

  generateReport() {
    const totalChecks = 5;
    const passedChecks = Object.values(this.results).filter(v => v === true).length;
    const successRate = ((passedChecks / totalChecks) * 100).toFixed(1);

    console.log('\n' + '='.repeat(60));
    console.log('📊 Onboarding System Test Results');
    console.log('='.repeat(60));
    console.log(`Test User: ${this.testEmail}`);
    console.log(`User ID: ${this.testUserId || 'N/A'}`);
    console.log('\nInitialization Status:');
    console.log(`  ${this.results.trialCreated ? '✅' : '❌'} Trial Subscription Created`);
    console.log(`  ${this.results.demoOffersCreated ? '✅' : '❌'} Demo Offers Created (8 expected)`);
    console.log(`  ${this.results.welcomeNotification ? '✅' : '❌'} Welcome Notification Sent`);
    console.log(`  ${this.results.checkinInitialized ? '✅' : '❌'} Checkin System Initialized`);
    console.log(`  ${this.results.referralCodeGenerated ? '✅' : '❌'} Referral Code Generated`);
    console.log(`\nSuccess Rate: ${successRate}% (${passedChecks}/${totalChecks})`);

    if (this.results.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      this.results.errors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err}`);
      });
    }

    console.log('='.repeat(60));

    return {
      testUser: this.testEmail,
      userId: this.testUserId,
      results: this.results,
      successRate: parseFloat(successRate),
      passed: passedChecks === totalChecks
    };
  }
}

// Main execution
async function main() {
  console.log('🎯 New User Onboarding System E2E Test');
  console.log('Environment: Preview (www.urlchecker.dev)');
  console.log('Testing: Trial → Demo Offers + Notifications + Checkin + Referral\n');

  const tester = new OnboardingSystemTester();

  try {
    await tester.setup();
    await tester.testOnboardingFlow();

    const report = tester.generateReport();

    if (report.passed) {
      console.log('\n🎉 All onboarding checks passed! System is working correctly.');
      process.exit(0);
    } else if (report.successRate >= 80) {
      console.log('\n⚠️  Most checks passed, but some issues detected.');
      process.exit(1);
    } else {
      console.log('\n❌ Onboarding system has significant issues.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Onboarding test failed:', error.message);
    process.exit(1);

  } finally {
    await tester.cleanup();
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Received interrupt signal, cleaning up...');
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received termination signal, cleaning up...');
  process.exit(143);
});

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
