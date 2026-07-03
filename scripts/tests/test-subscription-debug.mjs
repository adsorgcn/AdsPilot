import puppeteer from 'puppeteer';

const api = 'https://www.urlchecker.dev';

async function test() {
  console.log('🚀 Starting subscription page test...\n');

  // Get test session
  console.log('1️⃣ Creating test session...');
  const sessionResp = await fetch(api + '/api/test/create-session', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({role: 'user'})
  });

  if (!sessionResp.ok) {
    console.log('❌ Failed to create session:', sessionResp.status);
    return;
  }

  const session = await sessionResp.json();
  console.log('✅ Session created, user:', session.user?.email);

  // Test subscription API directly
  console.log('\n2️⃣ Testing subscription API...');
  const subApiResp = await fetch(api + '/api/v1/billing/subscriptions/me', {
    headers: {'Authorization': 'Bearer ' + session.access_token}
  });

  console.log('HTTP Status:', subApiResp.status);
  console.log('Content-Type:', subApiResp.headers.get('content-type'));

  const subData = await subApiResp.text();
  console.log('Response length:', subData.length);
  console.log('Response preview:', subData.substring(0, 200));

  if (subData.includes('<!DOCTYPE html>')) {
    console.log('⚠️  API returned HTML instead of JSON!');
  }

  // Test with browser
  console.log('\n3️⃣ Testing with browser...');
  const browser = await puppeteer.launch({headless: 'new'});
  const page = await browser.newPage();

  // Monitor network
  let apiCalled = false;
  let apiStatus = null;
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/v1/billing/subscriptions')) {
      apiCalled = true;
      apiStatus = response.status();
      console.log(`📡 API call: ${url} -> ${apiStatus}`);
    }
  });

  // Set auth
  await page.evaluateOnNewDocument((token) => {
    const authData = {
      access_token: token,
      refresh_token: token,
      expires_in: 3600,
      token_type: 'bearer',
      user: {id: 'test'}
    };
    localStorage.setItem('sb-YOUR_SUPABASE_PROJECT-auth-token', JSON.stringify(authData));
  }, session.access_token);

  // Navigate
  console.log('📄 Navigating to subscription page...');
  try {
    await page.goto(api + '/settings/subscription', {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });

    console.log('✅ Page loaded');

    await page.waitForTimeout(3000);

    const title = await page.title();
    console.log('Title:', title);

    console.log('API called during page load:', apiCalled);
    if (apiCalled) {
      console.log('API status:', apiStatus);
    }

  } catch (err) {
    console.log('❌ Navigation error:', err.message);
  }

  await browser.close();
}

test().catch(console.error);
