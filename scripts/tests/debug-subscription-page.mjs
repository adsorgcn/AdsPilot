#!/usr/bin/env node
import puppeteer from 'puppeteer';
import { setupAuthForTest } from './helpers/auth.mjs';

const base = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';

async function main() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // Monitor console
  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      console.log(`[${type.toUpperCase()}]`, msg.text());
    }
  });

  page.on('pageerror', (err) => {
    console.log('❌ Page Error:', err.message);
  });

  page.on('requestfailed', (req) => {
    console.log('❌ Request Failed:', req.url(), '-', req.failure().errorText);
  });

  // Login
  console.log('🔐 Logging in...');
  await setupAuthForTest(page, 'user');
  console.log('✅ Login successful\n');

  // Navigate to subscription page
  console.log('📄 Navigating to subscription page...');
  try {
    const response = await page.goto(`${base}/settings/subscription`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
    console.log('✅ Page loaded, HTTP status:', response.status());

    // Wait a bit for JS to execute
    await page.waitForTimeout(3000);

    // Check page content
    const title = await page.title();
    console.log('📌 Page title:', title);

    const html = await page.content();
    console.log('📏 HTML length:', html.length);

    // Check for API errors in network
    const apiCalls = await page.evaluate(() => {
      return performance.getEntriesByType('resource')
        .filter(r => r.name.includes('/api/'))
        .map(r => ({
          url: r.name,
          duration: r.duration
        }));
    });

    console.log('\n🌐 API Calls:');
    apiCalls.forEach(call => {
      console.log(`  - ${call.url} (${call.duration.toFixed(0)}ms)`);
    });

    // Take screenshot
    await page.screenshot({ path: '/tmp/subscription-page-debug.png', fullPage: true });
    console.log('\n📸 Screenshot saved to /tmp/subscription-page-debug.png');

  } catch (err) {
    console.log('❌ Error:', err.message);
  }

  await browser.close();
}

main().catch(console.error);
