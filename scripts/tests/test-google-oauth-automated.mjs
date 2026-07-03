/**
 * Automated Google OAuth Login Test
 * 使用 Playwright 完全自动化测试，包括 Google 登录
 */

import { chromium } from 'playwright';

const PREVIEW_BASE = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';
const GOOGLE_EMAIL = process.env.GOOGLE_EMAIL || 'manhwarecap99@gmail.com';
const GOOGLE_PASSWORD = process.env.GOOGLE_PASSWORD;

async function testGoogleOAuthAutomated() {
  console.log('\n🤖 Automated Google OAuth Test');
  console.log('📍 Target: ' + PREVIEW_BASE);
  console.log('👤 Email: ' + GOOGLE_EMAIL + '\n');

  if (!GOOGLE_PASSWORD) {
    console.error('❌ GOOGLE_PASSWORD environment variable not set');
    console.log('Usage: GOOGLE_PASSWORD="yourpass" node test-google-oauth-automated.mjs\n');
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
  });

  const page = await context.newPage();

  // Capture all console logs
  const logs = [];
  page.on('console', (msg) => {
    const text = msg.text();
    const type = msg.type();
    logs.push({ type, text, time: new Date().toISOString() });
    
    if (text.includes('[OAuth') || text.includes('[Session') || 
        text.includes('[Firebase') || text.includes('Error')) {
      console.log(`[${type}] ${text}`);
    }
  });

  // Capture API responses
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/session/sign-in')) {
      console.log('\n📡 /api/session/sign-in: ' + response.status());
      if (response.status() !== 200) {
        try {
          const body = await response.text();
          console.log('Response:', body);
        } catch (e) {}
      }
    }
  });

  try {
    // Step 1: Go to sign-in page
    console.log('📄 Step 1: Loading sign-in page...');
    await page.goto(PREVIEW_BASE + '/auth/sign-in', { waitUntil: 'networkidle' });
    console.log('✅ Page loaded\n');

    // Step 2: Click Google button
    console.log('🔍 Step 2: Finding Google OAuth button...');
    await page.waitForSelector('button:has-text("Google")');
    console.log('✅ Found button\n');

    console.log('🖱️  Step 3: Clicking Google OAuth button...');
    await page.click('button:has-text("Google")');
    console.log('✅ Clicked, waiting for Google sign-in page...\n');

    // Step 4: Wait for Google login page
    console.log('⏳ Step 4: Waiting for Google login page...');
    await page.waitForURL(/accounts\.google\.com/, { timeout: 10000 });
    console.log('✅ Redirected to Google\n');

    // Step 5: Enter email
    console.log('📧 Step 5: Entering email...');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', GOOGLE_EMAIL);
    await page.click('button:has-text("Next"), #identifierNext');
    console.log('✅ Email entered\n');

    // Step 6: Enter password
    console.log('🔑 Step 6: Entering password...');
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.fill('input[type="password"]', GOOGLE_PASSWORD);
    await page.click('button:has-text("Next"), #passwordNext');
    console.log('✅ Password entered\n');

    // Step 7: Wait for redirect back
    console.log('⏳ Step 7: Waiting for OAuth redirect back...');
    await page.waitForURL((url) => {
      const urlStr = url.toString();
      return urlStr.includes(PREVIEW_BASE);
    }, { timeout: 30000 });
    console.log('✅ Redirected back to app\n');

    // Step 8: Wait for final destination
    console.log('⏳ Step 8: Waiting for final redirect...');
    await page.waitForTimeout(5000);

    const finalUrl = page.url();
    console.log('📍 Final URL: ' + finalUrl + '\n');

    // Check result
    if (finalUrl.includes('/dashboard') || finalUrl.includes('/offers') || 
        finalUrl === PREVIEW_BASE + '/' || finalUrl === PREVIEW_BASE + '/en') {
      console.log('✅✅✅ LOGIN SUCCESS! ✅✅✅\n');

      // Check session cookie
      const cookies = await context.cookies();
      const sessionCookie = cookies.find(c => c.name === 'session');
      if (sessionCookie) {
        console.log('🍪 Session cookie:', {
          domain: sessionCookie.domain,
          expires: new Date(sessionCookie.expires * 1000).toISOString(),
        });
      } else {
        console.log('⚠️  No session cookie found');
      }
    } else if (finalUrl.includes('/auth/sign-in')) {
      console.log('❌ FAILED - Still on sign-in page\n');
      
      // Check for error message
      const errorText = await page.textContent('body').catch(() => '');
      if (errorText.includes('error') || errorText.includes('failed')) {
        console.log('Error on page:', errorText.substring(0, 200));
      }
    } else {
      console.log('⚠️  UNEXPECTED - Unknown page\n');
    }

    // Print logs summary
    console.log('\n📋 Logs Summary:');
    const errors = logs.filter(l => l.type === 'error');
    const authLogs = logs.filter(l => 
      l.text.includes('[OAuth') || l.text.includes('[Session') || 
      l.text.includes('[Firebase') || l.text.includes('[createSessionCookie')
    );

    console.log('Total logs: ' + logs.length);
    console.log('Errors: ' + errors.length);
    console.log('Auth logs: ' + authLogs.length + '\n');

    if (authLogs.length > 0) {
      console.log('🔐 Auth Flow Logs:');
      authLogs.forEach(l => console.log('  ' + l.text));
      console.log('');
    }

    if (errors.length > 0) {
      console.log('❌ Error Logs:');
      errors.forEach(l => console.log('  ' + l.text));
      console.log('');
    }

    // Keep browser open
    console.log('🔍 Keeping browser open for 30 seconds...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await page.screenshot({ path: '/tmp/oauth-auto-error.png' });
    console.log('📸 Screenshot: /tmp/oauth-auto-error.png\n');
    throw error;
  } finally {
    await browser.close();
    console.log('👋 Done\n');
  }
}

testGoogleOAuthAutomated()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
