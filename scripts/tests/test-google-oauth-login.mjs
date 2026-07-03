/**
 * Test Google OAuth Login
 * 
 * 使用方法：
 * 1. 先关闭所有 Chrome 窗口
 * 2. 运行此脚本，它会自动启动带调试端口的 Chrome
 * 3. 使用你本地已登录的 Google 账号
 */

import { chromium } from 'playwright';
import { spawn } from 'child_process';

const PREVIEW_BASE = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';
const CDP_PORT = 9222;

async function startChromeWithDebugPort() {
  console.log('🚀 Starting Chrome with remote debugging port ' + CDP_PORT + '...\n');
  
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const userDataDir = process.env.HOME + '/Library/Application Support/Google/Chrome';
  
  const chromeProcess = spawn(chromePath, [
    '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + userDataDir,
    '--no-first-run',
    '--no-default-browser-check',
  ], {
    detached: true,
    stdio: 'ignore'
  });
  
  chromeProcess.unref();
  
  // Wait for Chrome to start
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('✅ Chrome started with debugging enabled\n');
}

async function testGoogleOAuthLogin() {
  console.log('🚀 Google OAuth Login Test');
  console.log('📍 Target: ' + PREVIEW_BASE + '/auth/sign-in\n');

  let browser;
  try {
    // Try to connect to existing Chrome with debug port
    try {
      browser = await chromium.connectOverCDP('http://localhost:' + CDP_PORT);
      console.log('✅ Connected to existing Chrome instance\n');
    } catch (e) {
      console.log('⚠️  Chrome not running with debug port, starting new instance...\n');
      await startChromeWithDebugPort();
      
      // Retry connection
      await new Promise(resolve => setTimeout(resolve, 2000));
      browser = await chromium.connectOverCDP('http://localhost:' + CDP_PORT);
      console.log('✅ Connected to Chrome\n');
    }

    const contexts = browser.contexts();
    const context = contexts[0];
    const page = await context.newPage();

    const consoleLogs = [];
    page.on('console', (msg) => {
      const text = msg.text();
      const msgType = msg.type();
      consoleLogs.push({ type: msgType, text, timestamp: new Date().toISOString() });

      if (text.includes('[OAuth') || text.includes('[Session') || 
          text.includes('[Firebase') || text.includes('[createSessionCookie') || 
          text.includes('[getDecodedToken') || text.includes('Error') || text.includes('error')) {
        const prefix = msgType === 'error' ? '❌' : msgType === 'warning' ? '⚠️' : 'ℹ️';
        console.log(prefix + ' ' + text);
      }
    });

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/session/sign-in')) {
        const status = response.status();
        console.log('\n📡 /api/session/sign-in → ' + status + ' ' + response.statusText());
        
        if (status !== 200) {
          try {
            const body = await response.text();
            console.log('   Response: ' + body);
          } catch (e) {}
        }
      }
    });

    console.log('📄 Navigating to sign-in page...');
    await page.goto(PREVIEW_BASE + '/auth/sign-in', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    console.log('✅ Page loaded\n');

    await page.waitForTimeout(2000);

    console.log('🔍 Finding Google OAuth button...');
    const googleButton = await page.waitForSelector('button:has-text("Google")', { timeout: 10000 });
    console.log('✅ Found Google button\n');

    console.log('🖱️  Clicking Google OAuth button...');
    console.log('⏳ Waiting for OAuth flow (you may need to select Google account)...\n');

    await googleButton.click();

    const result = await Promise.race([
      page.waitForURL((url) => {
        const urlStr = url.toString();
        return (urlStr.includes('/dashboard') || urlStr.includes('/offers') ||
                urlStr === PREVIEW_BASE + '/' || urlStr === PREVIEW_BASE + '/en') &&
                !urlStr.includes('/auth/sign-in');
      }, { timeout: 120000 }).then(() => 'success'),

      page.waitForSelector('text=/error|failed|unauthorized/i', { timeout: 120000 }).then(() => 'error'),
    ]).catch(() => 'timeout');

    if (result === 'success') {
      console.log('\n✅✅✅ LOGIN SUCCESS! ✅✅✅');
      console.log('📍 Final URL: ' + page.url() + '\n');

      const cookies = await context.cookies();
      const sessionCookie = cookies.find(c => c.name === 'session');
      if (sessionCookie) {
        console.log('🍪 Session cookie:', {
          name: sessionCookie.name,
          domain: sessionCookie.domain,
          expires: new Date(sessionCookie.expires * 1000).toISOString(),
        });
      } else {
        console.log('⚠️  No session cookie found');
      }
    } else if (result === 'error') {
      console.log('\n❌ LOGIN FAILED');
      console.log('Current URL: ' + page.url());
      await page.screenshot({ path: '/tmp/oauth-error.png' });
      console.log('📸 Screenshot: /tmp/oauth-error.png');
    } else {
      console.log('\n⏱️  TIMEOUT');
      console.log('Current URL: ' + page.url());
    }

    console.log('\n📋 Console Logs:');
    const errorLogs = consoleLogs.filter(log => log.type === 'error');
    const authLogs = consoleLogs.filter(log =>
      log.text.includes('[OAuth') || log.text.includes('[Session') ||
      log.text.includes('[Firebase') || log.text.includes('[createSessionCookie') ||
      log.text.includes('[getDecodedToken')
    );

    console.log('   Total: ' + consoleLogs.length);
    console.log('   Errors: ' + errorLogs.length);
    console.log('   Auth logs: ' + authLogs.length + '\n');

    if (authLogs.length > 0) {
      console.log('🔐 Auth Flow:');
      authLogs.forEach(log => console.log('   ' + log.text));
      console.log('');
    }

    if (errorLogs.length > 0) {
      console.log('❌ Errors:');
      errorLogs.slice(-5).forEach(log => console.log('   ' + log.text));
      console.log('');
    }

    console.log('🔍 Keeping page open for 30 seconds...');
    await page.waitForTimeout(30000);

    await page.close();

  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
    console.log('\n👋 Test finished\n');
  }
}

testGoogleOAuthLogin()
  .then(() => {
    console.log('✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed');
    process.exit(1);
  });
